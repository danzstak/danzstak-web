import email
import logging
import os
from email.message import EmailMessage
from email.policy import default

import boto3


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

S3_BUCKET = os.environ["MAIL_BUCKET"]
S3_PREFIX = os.environ.get("MAIL_PREFIX", "incoming/")
FORWARD_TO = os.environ["FORWARD_TO"]
SUPPORT_ADDRESS = os.environ.get("SUPPORT_ADDRESS", "support@danzstak.com")

s3 = boto3.client("s3")
ses = boto3.client("ses")


def _copy_body_and_attachments(source, outgoing):
    plain = None
    html = None
    attachments = []

    for part in source.walk():
        disposition = part.get_content_disposition()
        content_type = part.get_content_type()
        if disposition == "attachment" or part.get_filename():
            attachments.append(part)
        elif content_type == "text/plain" and plain is None:
            plain = part.get_content()
        elif content_type == "text/html" and html is None:
            html = part.get_content()

    sender = source.get("From", "Unknown sender")
    prefix = f"Support request originally sent by: {sender}\n\n"
    outgoing.set_content(prefix + (plain or "See the attached HTML message."))
    if html:
        outgoing.add_alternative(
            f"<p><strong>Support request originally sent by:</strong> {sender}</p>{html}",
            subtype="html",
        )

    for part in attachments:
        payload = part.get_payload(decode=True)
        if payload is None:
            continue
        maintype, subtype = part.get_content_type().split("/", 1)
        outgoing.add_attachment(
            payload,
            maintype=maintype,
            subtype=subtype,
            filename=part.get_filename(),
        )


def lambda_handler(event, context):
    for record in event.get("Records", []):
        message_id = record["ses"]["mail"]["messageId"]
        key = f"{S3_PREFIX}{message_id}"
        response = s3.get_object(Bucket=S3_BUCKET, Key=key)
        with response["Body"] as body:
            raw_message = body.read()

        source = email.message_from_bytes(raw_message, policy=default)
        outgoing = EmailMessage()
        outgoing["From"] = f"DanzStak Support <{SUPPORT_ADDRESS}>"
        outgoing["To"] = FORWARD_TO
        outgoing["Subject"] = source.get("Subject", "DanzStak support request")
        if source.get("Reply-To") or source.get("From"):
            outgoing["Reply-To"] = source.get("Reply-To") or source.get("From")
        outgoing["X-DanzStak-Original-Message-Id"] = message_id
        _copy_body_and_attachments(source, outgoing)

        ses.send_raw_email(
            Source=SUPPORT_ADDRESS,
            Destinations=[FORWARD_TO],
            RawMessage={"Data": outgoing.as_bytes()},
        )
        LOGGER.info("Forwarded support message %s", message_id)

    return {"forwarded": len(event.get("Records", []))}
