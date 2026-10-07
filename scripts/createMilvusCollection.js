require("dotenv").config();
const { MilvusClient, DataType } = require("@zilliz/milvus2-sdk-node");

async function main() {
    const address = process.env.MILVUS_ADDRESS || 
        (process.env.MILVUS_HOST ? `${process.env.MILVUS_HOST}:${process.env.MILVUS_PORT || 19530}` : '');
    const token = process.env.MILVUS_TOKEN || '';
    const ssl = process.env.MILVUS_SSL !== undefined 
        ? process.env.MILVUS_SSL === 'true' 
        : address.startsWith('https://');

    console.log(`Connecting to Milvus at: ${address}`);
    const client = new MilvusClient({
        address,
        token: token || undefined,
        ssl
    });

    const collectionName = "notebook_amamiya";
    const hasCol = await client.hasCollection({ collection_name: collectionName });

    if (hasCol.value) {
        console.log(`Collection "${collectionName}" already exists!`);
    } else {
        console.log(`Creating collection "${collectionName}"...`);
        const createRes = await client.createCollection({
            collection_name: collectionName,
            fields: [
                {
                    name: "id",
                    data_type: DataType.Int64,
                    is_primary_key: true,
                    auto_id: true,
                    description: "Primary key"
                },
                {
                    name: "fileHash",
                    data_type: DataType.VarChar,
                    max_length: 64,
                    description: "Hash dari file PDF"
                },
                {
                    name: "text_content",
                    data_type: DataType.VarChar,
                    max_length: 65535,
                    description: "Isi teks materi / ringkasan"
                },
                {
                    name: "page_number",
                    data_type: DataType.Int32,
                    description: "Nomor halaman PDF"
                },
                {
                    name: "image_url",
                    data_type: DataType.VarChar,
                    max_length: 1024,
                    description: "Path atau URL gambar visual"
                },
                {
                    name: "embedding",
                    data_type: DataType.FloatVector,
                    dim: 3072, // Dimensi gemini-embedding-001
                    description: "Vektor embedding Gemini"
                }
            ]
        });
        console.log("Create Collection Result:", createRes);

        console.log(`Creating index for "${collectionName}"...`);
        const indexRes = await client.createIndex({
            collection_name: collectionName,
            field_name: "embedding",
            metric_type: "COSINE"
        });
        console.log("Create Index Result:", indexRes);

        console.log(`Loading collection "${collectionName}"...`);
        const loadRes = await client.loadCollectionSync({
            collection_name: collectionName
        });
        console.log("Load Collection Result:", loadRes);
        console.log(`✅ Collection "${collectionName}" created and loaded successfully!`);
    }
}

main().catch(console.error);
