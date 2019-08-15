/**
 * Handler for a simple function which returns a URL to the latest plant photo I have!
 *
 * Works with Google Drive for image hosting.
 */

import { Context, APIGatewayEvent, Handler } from "aws-lambda";
import { google } from "googleapis";

/** Interface describing the data returned by plantGet */
interface IPlantRet {
    img_id: string;
    date_taken: string;
    if_you_can_see_this_i_love_you_so_much: boolean;
}
/** Interface describing the data returned by the Drive API */
interface IDriveRet {
    id: string;
    createdTime: string;
}

/** headers to return with this GET request */
const HEADERS = { "Access-Control-Allow-Origin": "https://howaremyplants.net" };
/** travis does newlines incorrectly, so I have to fix them here */
const DRIVE_KEY = process.env.drive_key.replace(/\\n/g, "\n");
/** The drive authentication client to use */
const AUTH_CLIENT = new google.auth.JWT(
    process.env.drive_email,
    null,
    DRIVE_KEY,
    ["https://www.googleapis.com/auth/drive.readonly"]);

/**
 * The main function handler for this API.
 * Takes no parameters, returns data useful for looking at pictures of plants
 * @returns {@link IGithubRet}
 */
export const plantget: Handler = async () => {
    try {
        // query my google drive!
        const res = await google.drive("v3").files.list({
            auth: AUTH_CLIENT,
            fields: "files(id,createdTime)",
            orderBy: "createdTime desc",
            pageSize: 1,
            q: "'1vCnwntNQvA6s24s8kqkhvu-0kzNexSyN' in parents",
        });
        // status check
        if (res.status !== 200)
            throw new Error(`Google API query returned status code ${res.status}`);
        // great! lets get some data
        const data: IDriveRet = res.data.files[0] as IDriveRet;
        // return it!
        return {
            body: JSON.stringify({
                date_taken: data.createdTime,
                if_you_can_see_this_i_love_you_so_much: true,
                img_id: data.id,
            }),
            headers: HEADERS,
            statusCode: 200,
        };
    } catch (e) {
        console.error(e);
        return {
            body: JSON.stringify({ message: "stuff is broken, please come again." }),
            headers: HEADERS,
            statusCode: 500,
        };
    }
};
