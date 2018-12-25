//arguments
let artifactName = "oxygen-training-3.json";
const downloadPath = "./src/artifacts/";
const retriesLimit = 3;
const esIndex = "oxygentraining-2018.08.24";
//
//dependencies
const ArtifactoryAPI = require("artifactory-api");
const JSONStream = require("jsonstream");
const fileSystem = require("fs");
const elasticsearch = require('elasticsearch');
////
////auxiliary objects
const artifactorySlc = new ArtifactoryAPI("http://artifactory-slc.oraclecorp.com", "");
const transformStream = JSONStream.parse( "*" );
const esClient = new elasticsearch.Client({
    host: 'http://logs-db-dev.doceng.oraclecorp.com:80/',
    apiVersion: '5.6'
});


///Step 1:
///parsing local file

  var inputStream = fileSystem.createReadStream(downloadPath+artifactName);

  inputStream.pipe( transformStream )
    // Each "data" event will emit one item in our folder-set.
    .on(
        "data",
        function handleRecord( folder ) {
            console.log( "Transform event triggered for folder:", folder.basePath, );
            console.log( "...it contains # topics", folder.topics.length );

            console.log("---Curating and indexing topics in folder---");
            
            ///each topic in the folder will be curated and indexed on an individual basis.
            curateTopics(folder);
        }
    )

    // .on(END): Once the JSONStream has parsed all the input, let's indicate done.
    .on(
        "end",
        function handleEnd() {

            console.log( "- - - - - - - - - - - - - - - - - - - - - - -" );
            console.log( "JSONStream parsing complete!" );

        }
    )
;


function curateTopics(folderObj){

    for (let j = 0; j < folderObj.topics.length; j++) {

        var topicObj = folderObj.topics[j];

        //map sourceObj to indexableObject
        var tempTopic = {};
        tempTopic.folderPath = folderObj.basePath;
        tempTopic.guid = topicObj.guid;
        tempTopic.title = topicObj.title;
        tempTopic.topicType = topicObj.topicType;
        tempTopic.lastModifiedOn = topicObj.workflow.lastModifiedOn;
        tempTopic.lastModifiedBy = topicObj.workflow.lastModifiedBy;

        //resulting tempTopic is ready to be indexed
        //not written to file as before
       indexTopic(tempTopic, esClient, retriesLimit);
  
    }
    console.log("topics in folder:", folderObj.topics.length);
}


  function indexTopic(topic2Index, elasticSearchCient, indexAttempt){
    console.log(`indexing topic ${topic2Index.guid} on attempt ${indexAttempt}`);
    elasticSearchCient.create({
        index: esIndex,
        type: 'topics',
        id: topic2Index.guid,
        body: {
          title: topic2Index.title,
          topicType: topic2Index.topicType,
          folderPath: topic2Index.folderPath,
          lastModifiedOn: topic2Index.lastModifiedOn,
          lastModifiedBy: topic2Index.lastModifiedBy
        }
      }, function (error, response, status) {
        if (error) {
          console.log(error);
          //add code to wait and resend... careful, could become cyclical? how o we implement retries?
          //send constant to function and ++ with each iteration, limit to global var value
          indexAttempt++;
          if (indexAttempt <= retriesLimit) {            
            setTimeout(function() {
              indexTopic(topic2Index, elasticSearchCient, indexAttempt);
            }, 500);            
          }
        } else {
          console.log(status);
          console.log(response);
        }
      });

  }