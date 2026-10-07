const { MilvusClient } = require("@zilliz/milvus2-sdk-node");
require("dotenv").config();

const address = process.env.MILVUS_ADDRESS || 
    (process.env.MILVUS_HOST ? `${process.env.MILVUS_HOST}:${process.env.MILVUS_PORT || 19530}` : '');

const token = process.env.MILVUS_TOKEN || '';
const ssl = process.env.MILVUS_SSL !== undefined 
    ? process.env.MILVUS_SSL === 'true' 
    : address.startsWith('https://');

const clientConfig = {
    address,
    ssl
};

if (token) {
    clientConfig.token = token;
}

const milvusClient = new MilvusClient(clientConfig);

module.exports = { milvusClient };
