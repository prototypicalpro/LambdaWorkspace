# Simple SSL Helper API

## About This API

This API was created to solve two problems:
1. The [BearSSL library](https://bearssl.org/) requires the user generate a static list of values from trusted root certificates. These values are used to verify the integrity of the server's certificate during the SSL handshake. I originally wanted to create a website that would take a list of domains, fetch the x509 certificates from them, and format the certificates into an array of trust anchors. However...
1. [There is no way to get a x509 certificate using browser Javascript.](https://stackoverflow.com/questions/2604399/is-there-a-way-to-get-ssl-certificate-details-using-javascript) Even if there was a way to get a certificate from a website...
1. [There is no way to access the root certificate store from Javascript either.](https://stackoverflow.com/questions/21004645/where-is-nodes-certificate-store) This makes is very difficult to match a website certificate to a trusted root certificate.

To solve these problems, I have created a Web API hosted on AWS instead, based off of the python script I wrote [here](https://github.com/OPEnSLab-OSU/SSLClient/tree/master/tools/pycert_bearssl). This API has three endpoints, https://certutil.prototypical.pro/getheader, https://certutil.prototypical.pro/getcert, and https://certutil.prototypical.pro/getrootcert, which solve problem 1, 2, and 3 respectively. These APIs are free and open to everyone (please be nice). 

All endpoints in this API take arguments as [query string parameters](https://en.wikipedia.org/wiki/Query_string), and return a JSON document. If this API fails, it will fail with an `Internal Server Error`.

## Using `/getcert` and `/getrootcert`

Both `/getcert` and `/getrootcert` require a list of domains to get certificates from, in the form of `?domain=www.google.com`. You can pass multiple domains at once by adding more query strings (e.g. `?domain=www.google.com&domain=www.amazon.com`), and there is no maximum to how many domains you can query at once--the function, however, will time out if too many domains are sent at once.

All data is returned in the form of a JSON document, which looks like so:
```JSON
{
  "valid_domains": [
    {
      "domain": "www.amazon.com",
      "label":  "www.amazon.com",
      "cert":   "-----BEGIN CERTIFICATE-----\n
                 ...
                 -----END CERTIFICATE-----\n"
    },
    {
      "domain": "www.google.com",
      "label":  "www.google.com",
      "cert":   "-----BEGIN CERTIFICATE-----\n
                 ...
                 -----END CERTIFICATE-----\n"
    }
  ],
  "invalid_domains": [
    "bad.domain"
  ]
}
```
Note some components in this data:
* `valid_domains` - Contains an array of objects which represent a fetched certificate. Each object has the property:
  * `domain` - The domain string input used to fetch the certificate.
  * `label` - A piece of data from the certificate (usually under `CN` in the subject) useful for indicating the certificate in a human readable format.
  * `cert` - The certificate, encoded in PEM format.
* `invalid_domains` - A list of domain strings that certificates could not be retrieved from.

Some examples of using this API (click the links to view the output):
* https://certutil.prototypical.pro/getcert?domain=www.amazon.com
* https://certutil.prototypical.pro/getrootcert?domain=www.amazon.com
* https://certutil.prototypical.pro/getrootcert?domain=www.amazon.com&domain=www.google.com&domain=www.cloudflare.com

## Using `/getheader`

`getheader` requires a list of domains in the same format as `getcert` and `getrootcert`. In addition, there some optional parameters which allow you to customize the header file:
* `array_name` - The name to use for the array variable in the trust anchor header. If omitted, will default to `TAs`.
* `length_name` - The name to use for the array size define in the trust anchor header. If omitted, will default to `TAs_NUM`.
* `guard_name` - The name to use for the header guard (usually all caps). If omitted, will default to `CERTIFICATES`.

Similar to `getcert` and `getrootcert`, data is returned as a JSON document:
```JSON
{
  "header": "#ifndef _CERTIFICATES_H_\n
             ...
             #endif /* ifndef _CERTIFICATES_H_ */\n",
  "valid_domains": [
    "www.amazon.com"
  ],
  "invalid_domains": [
    "bad.domain"
  ]
}
```
Note some components in this data:
* `header` - The header file containing an array of BearSSL trust anchors, as a giant string. Once the escaped characters are converted, it should look something like [this file](./sample_headers/cert.h). It be noted that this header file will not necessarily have a trust anchor for each domain, as `getheader` will automatically remove duplicated root certificates.
* `valid_domains` - A list of domain strings whose certificates were included in the header file.
* `invalid_domains` - A list of domain strings that certificates could not be retrieved from.

Some examples of using this API (click the links to view the output):
* https://certutil.prototypical.pro/getheader?domain=www.amazon.com
  * Generates [this header](./sample_headers/cert.h).
* https://certutil.prototypical.pro/getheader?domain=www.arduino.cc&domain=www.google.com&domain=www.youtube.com
  * Generates [this header](./sample_headers/certs_with_dupe.h).
* https://certutil.prototypical.pro/getheader?domain=www.arduino.cc&array_name=myarray&length_name=mylength&guard_name=MYGUARD
  * Generates [this header](./sample_headers/cert_with_custom.h).

## How It Works

This API uses the pyOpenSSL code from the [Adafruit Pycert Tool](https://learn.adafruit.com/introducing-the-adafruit-wiced-feather-wifi/pycert-dot-py) to fetch a certificate chain from a domain. If we need the root certificate, the highest certificate in the chain is then matched against the trusted certificate store [certifi](https://pypi.org/project/certifi/), giving a single root certificate corresponding to the chain. Finally, the certificate is extracted and parsed into it's components, and spliced into several string templates--creating the BearSSL header file.

## Questions?

Feel free to contact me at my [email](mailto:noah@koontzs.com) if you have any questions about this API.