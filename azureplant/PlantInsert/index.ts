import { AzureFunction, Context } from "@azure/functions";
import { MongoClient, MongoClientOptions } from "mongodb";
import { Validator } from "jsonschema";

interface IMessage {
    time: number;
    data: { [ key: string ]: number };
}

const MessageSchema = {
    additionalProperties: false,
    properties: {
        data: {
            additionalProperties: false,
            patternProperties: {
                "^\\w+$": {
                    type: "number",
                },
            },
            type: "object",
        },
        meta: {
            additionalProperties: false,
            properties: {
                name: {
                    pattern: "^\\w+$",
                    type: "string",
                },
                time: {
                    minimum: 0,
                    type: "integer",
                },
            },
            required: ["time", "name"],
            type: "object",
        },
    },
    required: ["meta", "data"],
    type: "object",
};

const MessageValidator = new Validator();
const MONGO_DB = "plantdata";

// connect to MongoDB outside, so the connection is persisted
let Mongo: MongoClient | null = null;
async function getMongoClient(): Promise<MongoClient> {
    if (Mongo === null || !Mongo.isConnected()) {
        Mongo = await MongoClient.connect(`mongodb+srv://${ encodeURIComponent(process.env.MONGO_USER) }:${ encodeURIComponent(process.env.MONGO_PASS) }@${ process.env.MONGO_SERVER }?tls=true&retryWrites=true&w=majority&connectTimeoutMS=2500&socketTimeoutMS=2500&compressors=snappy,zlib`, {
            tlsAllowInvalidCertificates: false,
            useNewUrlParser: true,
            useUnifiedTopology: true,
        } as MongoClientOptions);
    }

    return Mongo;
}

const eventHubTrigger: AzureFunction = async (context: Context, eventHubMessages: [IMessage]): Promise<void> => {
    // filter all the events down to ones that pass the JSON schema checks
    const validatedMessages = eventHubMessages.filter((msg: IMessage) => {
        const result = MessageValidator.validate(msg, MessageSchema);
        if (!result.valid)
            context.log(`Event "${ JSON.stringify(msg) }" failed schema validation with errors "${ JSON.stringify(result.errors) }"`);
        return result.valid;
    });

    // break if we run out of messages
    if (validatedMessages.length === 0)
        return;

    // do mongodb stuff
    let mongo: MongoClient | null = null;
    try {
        mongo = await getMongoClient();
        // get the plant database
        const db = mongo.db(MONGO_DB);
        // insert into the plantdata collection
        const result = await db.collection(MONGO_DB).insertMany(validatedMessages);
    } catch (e) {
        context.log("Got exception: ");
        context.log(e.message);
    }
};

export default eventHubTrigger;
