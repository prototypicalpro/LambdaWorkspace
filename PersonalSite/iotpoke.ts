/**
 * IoT MQTT helper functions
 * Provides methods to simplify poking my esp8266 using the AWS IoT framework
 */

import * as AWS from "aws-sdk";

/** the interface dectribing the structure of the topic this file will publish to */
interface ITopic {
    /** my total number of github contribution */
    totalContrib: number;
}

/** the API endpoint of my MQTT topic */
const IOT_API = "a3edhxbrp0jd6-ats.iot.us-west-2.amazonaws.com";
/** the update shadow topic */
const IOT_TOPIC = "$aws/things/ESPGithubMoniter/shadow/update";

/** the IoT data object, which will be used to update my device */
const Iot = new AWS.IotData({endpoint : IOT_API});

/** function to update the devices shadow in the cloud */
export function updateIotCounter(count: number): Promise<{}> {
    return Iot.publish({
        payload: JSON.stringify({
            state: {
                desired: {
                    totalContrib: count,
                },
            },
        }),
        topic: IOT_TOPIC,
    }).promise();
}
