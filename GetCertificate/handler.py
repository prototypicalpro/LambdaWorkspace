import json
import certifi
import cert_util
import re
from cryptography.hazmat.primitives.serialization import Encoding

# domain validation pattern, stolen from https://validators.readthedocs.io/en/latest/_modules/validators/domain.html
DOM_VAL_PAT = re.compile(
    r'^(([a-zA-Z]{1})|([a-zA-Z]{1}[a-zA-Z]{1})|'
    r'([a-zA-Z]{1}[0-9]{1})|([0-9]{1}[a-zA-Z]{1})|'
    r'([a-zA-Z0-9][-_.a-zA-Z0-9]{0,61}[a-zA-Z0-9]))\.'
    r'([a-zA-Z]{2,13}|[a-zA-Z0-9-]{2,30}.[a-zA-Z]{2,3})$'
)

# really long dict key
Q_STR_KEY = "multiValueQueryStringParameters"

# error response, we can do any debugging in the lambda console
ERROR = {
    "statusCode": 500,
    "body": "{\"message\":\"Could not proccess your request.\"}" 
}

# dict of root certificate objects, which we will use in cert_util later
CERT_DICT = dict([(cert.get_subject().hash(), cert) for cert in cert_util.parse_root_certificate_store(open(certifi.where(), "r"))])

# template for each valid domain item in the JSON output
VAL_CERT_FMT = """{{"domain":"{dom}","label":"{label}","root_cert":"{cert}"}}"""

# template the final formatted output
CERT_OUT_FMT = """{{"valid_domains":[{dom_val}],"invalid_domains":[{dom_inval}]}}"""
HEAD_OUT_FMT = """{{"header":{head},"valid_domains":[{dom_val}],"invalid_domains":[{dom_inval}]}}"""

# Default name for the cert length varible
CERT_LENGTH_NAME = "TAs_NUM"
# Defualt name for the cert array varible
CERT_ARRAY_NAME = "TAs"

def validate_domain(dom_str):
    """ Validate a domain string """
    # domains can be no longer than 256 characters in length
    # really nice because this prevents a bunch of regex ddos attacks
    if(len(dom_str) > 256):
        return False
    # check against regex
    return DOM_VAL_PAT.match(dom_str) is not None

def validate_and_get_certs(domains):
    # iterate through the domains, fetching the certificates for each one
    out_invalid = []
    out_valid = []
    for d in domains:
        # if it's not invalid, store that to format later
        if not validate_domain(d):
            out_invalid.append(d)
            continue
        # else fetch the certificate
        try:
            out_valid.append((d, cert_util.get_server_root_cert(d, 443, CERT_DICT)))
        except:
            # if there's an error, mark as invalid and continue
            print("Error!")
            print(sys.exc_info()[0])
            out_invalid.append(d)
    # return
    return (out_invalid, out_valid)

def get_cert(event, context):
    # check that the input object is formatted correctly
    if event is None or Q_STR_KEY not in event or "domain" not in event[Q_STR_KEY]:
        return ERROR
    # extract domains from the event object
    domains = event[Q_STR_KEY]["domain"]
    # iterate through the domains, fetching the certificates for each one
    invalid_out, valid_out = validate_and_get_certs(domains)
    # format the certificate into a string, and add it to the valid array
    valid_out_str = [VAL_CERT_FMT.format(
        dom=d,
        label=cert_util.get_label(cert),
        cert=cert.to_cryptography().public_bytes(Encoding.PEM).decode("utf-8").replace("\n", "\\n")
    ) for d, cert in valid_out]
    # format the final output and return it
    return {
        "statusCode": 200,
        "body": CERT_OUT_FMT.format(
            dom_val=', '.join(valid_out_str),
            dom_inval="\"" + "\", \"".join(invalid_out) + "\""
        )
    }

def get_header(event, context):
    # check that the input object is formatted correctly
    if event is None or Q_STR_KEY not in event or "domain" not in event[Q_STR_KEY]:
        return ERROR
    # extract domains from the event object
    domains = event[Q_STR_KEY]["domain"]
    # iterate through the domains, fetching the certificates for each one
    out_invalid, out_valid_tuple = validate_and_get_certs(domains)
    # split the packed tuple for the function
    out_dom = [ d for d, cert in out_valid_tuple ]
    out_cert = [ cert for d, cert in out_valid_tuple ]
    # create the header from the certs, escaping all the weird stuff
    header = json.dumps(cert_util.x509_to_header(out_cert, CERT_ARRAY_NAME, CERT_LENGTH_NAME, False, "TRUST_ANCHOR", domains=domains))
    # return some JSON!
    return {
        "statusCode": 200,
        "body": HEAD_OUT_FMT.format(
            head=header,
            dom_inval="\"" + "\", \"".join(out_invalid) + "\"",
            dom_val="\"" + "\", \"".join(out_dom) + "\""
        )
    }