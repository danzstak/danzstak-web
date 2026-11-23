"use strict";
// A small, strict YAML reader for CloudFormation templates written in plain block style (no npm dependency: the
// regression suite runs without installing packages). It understands block mappings and sequences, flow lists
// ([a, 'b', !Ref C]), plain/'single'/"double" scalars, comments, and the CloudFormation short tags (!Ref, !Sub, !GetAtt,
// !If, !Equals, !Not, !And, !Or, !Condition, !Join, !Select, !Split, !FindInMap, !Base64, !ImportValue, !GetAZs), which
// become their long forms ({ Ref: x }, { "Fn::Sub": x } ...). Anything else (anchors, block scalars, flow mappings,
// multi-line plain scalars) throws, so a template that drifts outside what this reader proves is caught rather than
// misread. Used by test-deploy-boundary.cjs for infrastructure/github-deploy/bootstrap.yaml.

const LONG = { Ref: "Ref", Condition: "Condition" };
const FN = ["Sub", "GetAtt", "If", "Equals", "Not", "And", "Or", "Join", "Select", "Split", "FindInMap", "Base64", "ImportValue", "GetAZs"];

function tagged(tag, value) {
  if (LONG[tag]) return { [LONG[tag]]: value };
  if (!FN.includes(tag)) throw new Error(`Unsupported tag !${tag}`);
  if (tag === "GetAtt" && typeof value === "string") return { "Fn::GetAtt": value.split(".") };
  return { [`Fn::${tag}`]: value };
}

function stripComment(line) {
  let quote = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) {
        if (quote === "'" && line[i + 1] === "'") { i++; continue; }
        quote = "";
      } else if (quote === '"' && c === "\\") i++;
    } else if (c === "'" || c === '"') quote = c;
    else if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).replace(/\s+$/, "");
  }
  return line.replace(/\s+$/, "");
}

// Reads one flow/inline value starting at text[pos]; returns [value, nextPos].
function readValue(text, pos, inFlow) {
  while (text[pos] === " ") pos++;
  if (text[pos] === "!") {
    const match = /^!([A-Za-z]+)/.exec(text.slice(pos));
    if (!match) throw new Error(`Bad tag in: ${text}`);
    const [value, next] = readValue(text, pos + match[0].length, inFlow);
    return [tagged(match[1], value), next];
  }
  if (text[pos] === "[") {
    const list = [];
    pos++;
    for (;;) {
      while (text[pos] === " ") pos++;
      if (text[pos] === "]") return [list, pos + 1];
      const [item, next] = readValue(text, pos, true);
      list.push(item);
      pos = next;
      while (text[pos] === " ") pos++;
      if (text[pos] === ",") { pos++; continue; }
      if (text[pos] === "]") return [list, pos + 1];
      throw new Error(`Bad flow list: ${text}`);
    }
  }
  if (text[pos] === "{" ) throw new Error(`Flow mappings are not supported: ${text}`);
  if (text[pos] === "'") {
    let out = "";
    for (let i = pos + 1; i < text.length; i++) {
      if (text[i] === "'") {
        if (text[i + 1] === "'") { out += "'"; i++; continue; }
        return [out, i + 1];
      }
      out += text[i];
    }
    throw new Error(`Unclosed quote: ${text}`);
  }
  if (text[pos] === '"') {
    let out = "";
    for (let i = pos + 1; i < text.length; i++) {
      if (text[i] === "\\") { out += JSON.parse(`"\\${text[i + 1]}"`); i++; continue; }
      if (text[i] === '"') return [out, i + 1];
      out += text[i];
    }
    throw new Error(`Unclosed quote: ${text}`);
  }
  let end = pos;
  while (end < text.length && !(inFlow && (text[end] === "," || text[end] === "]"))) end++;
  const raw = text.slice(pos, end).trim();
  if (/^[|>&*]/.test(raw)) throw new Error(`Unsupported YAML construct: ${raw}`);
  if (/^-?\d+$/.test(raw)) return [Number(raw), end];
  if (raw === "true" || raw === "false") return [raw === "true", end];
  return [raw, end];
}

function scalar(text) {
  const [value, end] = readValue(text, 0, false);
  if (text.slice(end).trim()) throw new Error(`Unexpected text after value: ${text}`);
  return value;
}

// Splits "key: value" at the first ": " (or trailing ":") outside quotes.
function splitKey(text) {
  let quote = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote) quote = ""; continue; }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === ":" && (i === text.length - 1 || text[i + 1] === " ")) {
      let key = text.slice(0, i).trim();
      if (/^'.*'$|^".*"$/.test(key)) key = scalar(key);
      return [key, text.slice(i + 1).trim()];
    }
    if (c === "[" || c === "!") return null;
  }
  return null;
}

function parse(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n")
    .map((raw, index) => ({ text: stripComment(raw), number: index + 1 }))
    .filter(line => line.text.trim() && line.text.trim() !== "---")
    .map(line => {
      if (/\t/.test(line.text.match(/^\s*/)[0])) throw new Error(`Tab indentation on line ${line.number}`);
      return { indent: line.text.match(/^ */)[0].length, body: line.text.trim(), number: line.number };
    });
  let index = 0;

  function block(indent) {
    const first = lines[index];
    if (!first || first.indent < indent) return null;
    return first.body.startsWith("- ") || first.body === "-" ? sequence(first.indent) : mapping(first.indent);
  }

  function valueAfter(rest, indent) {
    if (rest === "") return block(indent + 1);
    return scalar(rest);
  }

  function mapping(indent) {
    const out = {};
    while (index < lines.length && lines[index].indent === indent && !lines[index].body.startsWith("- ")) {
      const line = lines[index];
      const pair = splitKey(line.body);
      if (!pair) throw new Error(`Expected "key: value" on line ${line.number}`);
      if (Object.prototype.hasOwnProperty.call(out, pair[0])) throw new Error(`Duplicate key ${pair[0]} on line ${line.number}`);
      index++;
      out[pair[0]] = valueAfter(pair[1], indent);
    }
    if (index < lines.length && lines[index].indent > indent) throw new Error(`Bad indentation on line ${lines[index].number}`);
    return out;
  }

  function sequence(indent) {
    const out = [];
    while (index < lines.length && lines[index].indent === indent && (lines[index].body.startsWith("- ") || lines[index].body === "-")) {
      const line = lines[index];
      const rest = line.body === "-" ? "" : line.body.slice(2).trim();
      if (rest === "") { index++; out.push(block(indent + 1)); continue; }
      if (splitKey(rest)) {
        // "- key: value" starts a mapping whose keys sit at indent + 2.
        lines[index] = { indent: indent + 2, body: rest, number: line.number };
        out.push(mapping(indent + 2));
        continue;
      }
      index++;
      out.push(scalar(rest));
    }
    return out;
  }

  const result = block(0);
  if (index !== lines.length) throw new Error(`Could not read line ${lines[index].number}`);
  return result;
}

module.exports = { parse };
