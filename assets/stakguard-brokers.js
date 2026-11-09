"use strict";
window.STAKGUARD_BROKER_REGISTRY = Object.freeze([
  { name:"California DROP", jurisdiction:"California", status:"Official free tool", checked:"2026-11-09", url:"https://privacy.ca.gov/drop/" },
  { name:"Spokeo", jurisdiction:"United States", status:"Verified official form", checked:"2026-11-09", url:"https://www.spokeo.com/optout", channel:"official_form" },
  { name:"Whitepages", jurisdiction:"United States", status:"Official process under review", checked:"2026-11-09", url:"https://www.whitepages.com/suppression-requests" },
  { name:"BeenVerified", jurisdiction:"United States", status:"Official process under review", checked:"2026-11-09", url:"https://www.beenverified.com/app/optout/search" },
  {
    name:"PeopleConnect Suppression Center",
    jurisdiction:"United States",
    status:"Verified member handoff",
    checked:"2026-11-09",
    url:"https://suppression.peopleconnect.us/privacy-center",
    channel:"email_and_form",
    email:"privacy@peopleconnect.us",
    subject:"Privacy request: suppress my information",
    requestTemplate:[
      "Hello PeopleConnect Privacy Team,",
      "",
      "I am requesting that PeopleConnect suppress records associated with me from its people-search services. I am making this request for myself.",
      "",
      "Full name: [YOUR FULL NAME]",
      "Email for verification: [YOUR EMAIL]",
      "Record or profile URL, if known: [RECORD URL]",
      "State or country: [YOUR STATE OR COUNTRY]",
      "",
      "Please send any required verification steps and the outcome to my email. I understand that you may need to verify this request.",
      "",
      "Thank you,",
      "[YOUR NAME]"
    ].join("\n")
  }
]);
