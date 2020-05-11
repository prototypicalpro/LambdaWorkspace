import sys
import json
import certifi
import cert_util
import validate_domain
from cryptography.hazmat.primitives.serialization import Encoding

# really long dict key
Q_STR_KEY = "multiValueQueryStringParameters"

# error response, we can do any debugging in the lambda console
ERROR = {
    "statusCode": 500,
    "headers": {
        "Access-Control-Allow-Origin": "*",
    },
    "body": "{\"message\":\"Could not proccess your request.\"}" 
}

# dict of root certificate objects, which we will use in cert_util later
CERT_DICT = dict([(cert.get_subject().hash(), cert) for cert in cert_util.parse_root_certificate_store(open(certifi.where(), "r"))])

# template for each valid domain item in the JSON output
VAL_CERT_FMT = """{{"domain":"{dom}","label":"{label}","cert":"{cert}"}}"""

# template the final formatted output
CERT_OUT_FMT = """{{"valid_domains":[{dom_val}],"invalid_domains":[{dom_inval}]}}"""
HEAD_OUT_FMT = """{{"header":{head},"valid_domains":[{dom_val}],"invalid_domains":[{dom_inval}]}}"""

# Default name for the cert length varible
CERT_LENGTH_NAME = "TAs_NUM"
# Defualt name for the cert array varible
CERT_ARRAY_NAME = "TAs"
# Default header guard name
GUARD_NAME = "CERTIFICATES"

def get_param(event, key, default):
    if "queryStringParameters" not in event or key not in event["queryStringParameters"]:
        return default
    param = event["queryStringParameters"][key]
    # saftey check! no injection here
    if len(param) > 512:
        return default
    return param

def validate_and_get_certs(domains, root):
    # validate all the domains
    invalid_dom, valid_dom = validate_domain.validate_domains(domains)
    # if there's an error, we gotta pass it up
    if valid_dom is None or invalid_dom is None:
        return (None, None)
    # iterate through the domains, fetching the certificates for each one
    out_valid = []
    for d in valid_dom:
        try:
            out_valid.append((d, cert_util.get_server_root_cert(d, 443, CERT_DICT, root=root)))
        except Exception:
            # if there's an error, mark as invalid and continue
            print("Error!")
            print(sys.exc_info()[0])
            invalid_dom.append(d)
    # return
    return (invalid_dom, out_valid)

def get_cert_impl(event, context, root):
    # check that the input object is formatted correctly
    if event is None or Q_STR_KEY not in event or event[Q_STR_KEY] is None or "domain" not in event[Q_STR_KEY]:
        return ERROR
    # extract domains from the event object
    domains = event[Q_STR_KEY]["domain"]
    # iterate through the domains, fetching the certificates for each one
    invalid_out, valid_out = validate_and_get_certs(domains, root)
    if invalid_out is None or valid_out is None:
        return ERROR
    # format the certificate into a string, and add it to the valid array
    valid_out_str = [VAL_CERT_FMT.format(
        dom=d,
        label=cert_util.get_label(cert),
        cert=cert.to_cryptography().public_bytes(Encoding.PEM).decode("utf-8").replace("\n", "\\n")
    ) for d, cert in valid_out]
    # format the final output and return it
    inval_str = ""
    if len(invalid_out) > 0:
        inval_str = "\"" + "\", \"".join(invalid_out) + "\""
    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
        },
        "body": CERT_OUT_FMT.format(
            dom_val=', '.join(valid_out_str),
            dom_inval=inval_str
        )
    }

def get_root(event, context):
    return get_cert_impl(event, context, True)

def get_cert(event, context):
    return get_cert_impl(event, context, False)

def get_header(event, context):
    # check that the input object is formatted correctly
    if event is None or Q_STR_KEY not in event or event[Q_STR_KEY] is None or "domain" not in event[Q_STR_KEY]:
        return ERROR
    # extract domains from the event object, and deduplicate
    domains = list(set(event[Q_STR_KEY]["domain"]))
    # iterate through the domains, fetching the certificates for each one
    out_invalid, out_valid_tuple = validate_and_get_certs(domains, True)
    if out_invalid is None or out_valid_tuple is None:
        return ERROR
    # split the packed tuple for the function
    out_dom = [ d for d, cert in out_valid_tuple ]
    out_cert = [ cert for d, cert in out_valid_tuple ]
    # create the header from the certs and some url parameters, escaping all the weird stuff
    header = "\"\""
    if len(out_cert) > 0:
        header = json.dumps(cert_util.x509_to_header(
            out_cert, 
            get_param(event, "array_name", CERT_ARRAY_NAME), 
            get_param(event, "length_name", CERT_LENGTH_NAME),
            False, 
            get_param(event, "guard_name", GUARD_NAME), 
            domains=domains))
    inval_str = ""
    if len(out_invalid) > 0:
        inval_str = "\"" + "\", \"".join(out_invalid) + "\""
    valid_str = ""
    if len(out_dom) > 0:
        valid_str = "\"" + "\", \"".join(out_dom) + "\""
    # return some JSON!
    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
        },
        "body": HEAD_OUT_FMT.format(
            head=header,
            dom_inval=inval_str,
            dom_val=valid_str
        )
    }