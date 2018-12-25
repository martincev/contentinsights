//arguments
let artifactName = "solutionsFolder-prod-2.json";
const downloadPath = "./src/artifacts/";
const retriesLimit = 3;
let esIndex = 'topicreuse-2018.06';
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
///retrieving json file from artifactory using ArtifactoryAPI
artifactorySlc.downloadFile("doceng-snapshot-local", "/com/oracle/reuse/topic-reuse/wreports/"+artifactName, downloadPath+artifactName, false).then(function (result) {
  console.log(result);

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
  
}).fail(function (err) {
  console.log('ERROR downloading JSON from Artifactory: ' + err);
});

function curateTopics(folderObj){

    for (let j = 0; j < folderObj.topics.length; j++) {

        var topicObj = folderObj.topics[j];

        //map sourceObj to indexableObject
        var tempTopic = {};
        tempTopic.folderPath = folderObj.basePath;
        tempTopic.guid = topicObj.guid;
        tempTopic.title = topicObj.title;
        tempTopic.topicType = topicObj.topicType;
        tempTopic.publications = [];
        tempTopic.workflow = topicObj.workflow;
        tempTopic.product = topicObj.product;

        //iterate through array of publications where a given topic is reused,
        //collect the relevant metadata from the reported topic
        //and populate the tempTopic.publications array
        topicObj.publications.forEach(publication => {

            var tempPub = {};
            tempPub.title = publication.title;
            tempPub.guid = publication.guid;
            tempPub.product = publication.product;
            tempPub.component = publication.component;
            tempPub.pubAlias = publication.pubAlias;
            tempPub.suite = publication.suite;
            tempPub.category = publication.category;
            tempPub.pubPartNo = publication.pubPartNo;

            tempTopic.publications.push(tempPub);
        });

        //resulting tempTopic is ready to be indexed
        //not written to file as before
       indexTopic(tempTopic, esClient, retriesLimit);
  
    }
    console.log("topics in folder:", folderObj.topics.length);
}

//auxiliary function to remove duplicates in a topic's publication array
//the duplicates exists due to the fact that versions are counted by the WS logic
function removeDups(pubArray) {
    var uniquePubs = [];
    var uniqueGuids = [];
  
    for (let i = 0; i < pubArray.length; i++) {
      if (uniqueGuids.indexOf(pubArray[i].guid) === -1) {
        uniquePubs.push(pubArray[i]);
        uniqueGuids.push(pubArray[i].guid);
      }
    }
  
    return uniquePubs;
  }

  function indexTopic(topic2Index, elasticSearchCient, indexAttempt){
    let uniquePubs = removeDups(topic2Index.publications);
    console.log(`indexing topic ${topic2Index.guid} on attempt ${indexAttempt}`);
    elasticSearchCient.create({
        index: esIndex,
        type: 'topics',
        id: topic2Index.guid,
        body: {
          title: topic2Index.title,
          topicType: topic2Index.topicType,
          folderPath: topic2Index.folderPath,
          publications: uniquePubs,
          reused: (uniquePubs.length > 0),
          reuseCount: uniquePubs.length,
          workflow: topic2Index.workflow,
          product: topic2Index.product
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