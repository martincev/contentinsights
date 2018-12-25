const elasticsearch = require("elasticsearch");

const esClient = new elasticsearch.Client({
    host: 'http://logs-db-dev.doceng.oraclecorp.com:80/',
    apiVersion: '5.6',
  });

esClient.indices.create({
    index: 'tg-testindex',
    body: {
        "mappings": {
            "topics": {
                "properties": {
                    "title": {"type": "text"},
                    "topicType": {"type": "keyword"},
                    "folderPath": {
                        "type": "text",
                        "fields": {
                            "full": {"type": "keyword"}
                        }
                    },
                    "publications": {
                        "type": "nested",
                        "properties": {
                            "title": {
                                "type": "text",
                                "fields": {
                                    "full": {"type": "keyword"}
                                }
                            },
                            "guid": {"type": "keyword"},
                            "pubAlias": {"type": "keyword"},
                            "pubPartNo": {"type": "keyword"},
                            "version": {"type": "keyword"},
                            "product": {"type": "keyword"},
                            "component": {"type": "keyword"},
                            "suite": {"type": "keyword"},
                            "category": {"type": "keyword"},
                        }
                    },
                    "reused": {"type": "boolean"},
                    "reuseCount": {"type": "short"},
                    "workflow": {
                        "properties": {
                            "status": {"type": "keyword"},
                            "author": {"type": "keyword"},
                            "faOwner": {"type": "keyword"},
                            "architect": {"type": "keyword"},
                            "editor": {"type": "keyword"},
                            "manager": {"type": "keyword"}
                        }
                    },
                    "product": {
                        "properties": {
                            "productName": {"type": "keyword"},
                            "productComponent": {"type": "keyword"},
                            "functionalArea": {"type": "keyword"},
                            "functionalSubarea": {"type": "keyword"},
                            "featureNo": {"type": "keyword"},
                            "keywords": {"type": "keyword"}
                        }
                    }
                }
            }
        }
    }
}, (error, resp, status) => {
    if(error){
        console.log(error);
    }
    else{
        console.log(status);
        console.log(resp);
    }
});