import re
from http import client
import ssl
import os
import sys
import json

# domain validation pattern, stolen from https://validators.readthedocs.io/en/latest/_modules/validators/domain.html
DOM_VAL_PAT = re.compile(
    r'^(([a-zA-Z]{1})|([a-zA-Z]{1}[a-zA-Z]{1})|'
    r'([a-zA-Z]{1}[0-9]{1})|([0-9]{1}[a-zA-Z]{1})|'
    r'([a-zA-Z0-9][-_.a-zA-Z0-9]{0,61}[a-zA-Z0-9]))\.'
    r'([a-zA-Z]{2,13}|[a-zA-Z0-9-]{2,30}.[a-zA-Z]{2,3})$'
)

SAFE_BROW_DOM = "safebrowsing.googleapis.com"
SAFE_BROW_PATH = "/v4/threatMatches:find?key=" + os.environ["google_api_key"]
SAFE_BROW_HEADERS = { "Content-Type": "application/json", "Connection": "close" }
SAFE_BROW_PAYLOAD_FMT = re.sub(r"\s+", "", """\
{{
    "client": {{
        "clientId": "SSLHelperAPI",
        "clientVersion": "1.0"
    }},
    "threatInfo": {{
        "threatTypes": ["THREAT_TYPE_UNSPECIFIED", "MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
        "platformTypes": ["ANY_PLATFORM"],
        "threatEntryTypes": ["URL"],
        "threatEntries": [{url_objs}]
    }}
}}""")
SAFE_BROW_URL_FMT ="""{{"url":"https://{dom}/"}}"""

def create_safe_brow_from_domains(domains):
    # create some url JSON documents
    url_strs = [ SAFE_BROW_URL_FMT.format(dom=d) for d in domains ]
    # create the final JSON payload
    return SAFE_BROW_PAYLOAD_FMT.format(url_objs=','.join(url_strs))

def validate_domains(dom_str_list):
    """ Validate a domain string, returns a tuple of (invalid_domain_list, valid_domain_list) or (None, None) if Google APIs are down """
    invalid_domain_list = []
    almost_valid_domain_list = []
    # check domains agaist simple stuff
    for dom_str in dom_str_list:
        # domains can be no longer than 256 characters in length
        # really nice because this prevents a bunch of regex ddos attacks
        # also check against regex
        if len(dom_str) > 256 or len(dom_str) < 4 or DOM_VAL_PAT.match(dom_str) is None:
            invalid_domain_list.append(dom_str)
        # else it's almost a valid domain
        else:
            almost_valid_domain_list.append(dom_str)
    # we still can't trust the internet though, so we should
    # check the domain against Google's safebrowsing API
    con = None
    data = None
    try:
        con = client.HTTPSConnection(SAFE_BROW_DOM, context=ssl.create_default_context())
        con.request("POST", SAFE_BROW_PATH, body=create_safe_brow_from_domains(almost_valid_domain_list), headers=SAFE_BROW_HEADERS)
        # get the response
        res = con.getresponse()
        if res.status != 200:
            print("Returned status code: " + str(res.status))
            return (None, None)
        # data!
        databytes = res.read()
        print(databytes)
        data = json.loads(databytes)
    except Exception:
        # if there's an error, return error
        print("Error!")
        print(sys.exc_info()[0])
        print(sys.exc_info()[1])
        print(sys.exc_info()[2])
        return (None, None)
    finally:
        # make sure to close the connection!
        if con is not None:
            con.close()
    # if there are no matches in the data (there probably aren't?), return all the domains!
    if "matches" not in data:
        return (invalid_domain_list, almost_valid_domain_list)
    # else we got a fat uh oh
    matches = data["matches"]
    valid_domain_list = []
    # sort domains by threat and not threat
    for d in almost_valid_domain_list:
        # by checking if the domain is a substring of the url
        matched = False
        for m in matches:
            if d in m["threat"]["url"]:
                invalid_domain_list.append(d)
                matched = True
                break
        # if it's not, add to valid list!
        if not matched:
            valid_domain_list.append(d)
    # now I'm ready
    return (invalid_domain_list, valid_domain_list)