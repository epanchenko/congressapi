const AWS = require('aws-sdk');
const catchAsync = require('../utils/catchAsync');

const { getPosition, stateCodes } = require('../utils/utils');

AWS.config.update({
  region: 'us-east-2',
});

let https = require('https');
let agent = new https.Agent({
  maxSockets: 25,
  keepAlive: true,
});

const ddb = new AWS.DynamoDB({
  apiVersion: '2012-08-10',
  httpOptions: {
    agent: agent,
  },
});

exports.getAllCommittees = catchAsync(async (req, res, next) => {
  const params = {
    TableName: 'Committee',
    ExpressionAttributeNames: {
      '#committeeName': 'name',
    },
    ProjectionExpression: '#committeeName, committee_id, subcommittee',
    Limit: 200,
  };

  const committees = [];

  ddb.scan(params, (err, data) => {
    if (err) {
      console.err('Error', err);
    } else {
      data.Items.forEach((element) => {
        if (element.subcommittee.S === 'no') {
          committees.push({
            committeeID: element.committee_id.S,
            committeeName:
              element.name.S.charAt(0).toUpperCase() + element.name.S.slice(1),
          });
        }
      });

      committees.sort((a, b) => (a.name > b.name ? 1 : -1));

      res.status(200).json({
        status: 'success',
        committees: committees,
      });
    }
  });
});

function getMember(bioguideID) {
  const params = {
    TableName: 'Legislator',
    KeyConditionExpression: 'bioguide_id = :b',
    ExpressionAttributeNames: {
      '#statename': 'state',
    },
    ProjectionExpression:
      'bioguide_id, last_name, first_name, party, #statename, district, chamber',
    ExpressionAttributeValues: {
      ':b': { S: bioguideID },
    },
  };

  return ddb.query(params).promise();
}

function getCommitteeName(committeeID) {
  const params = {
    TableName: 'Committee',
    KeyConditionExpression: 'committee_id = :c',
    ProjectionExpression: '#comName, committee_id',
    ExpressionAttributeNames: {
      '#comName': 'name',
    },
    ExpressionAttributeValues: {
      ':c': { S: committeeID },
    },
  };

  return ddb.query(params).promise();
}

exports.getSubCommittees = catchAsync(async (req, res, next) => {
  const { committeeID } = req.params;

  if (!committeeID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Committee',
    KeyConditionExpression: 'committee_id = :c',
    ExpressionAttributeNames: {
      '#committeeName': 'name',
    },
    ProjectionExpression: 'subcommittees, #committeeName',
    ExpressionAttributeValues: {
      ':c': { S: committeeID },
    },
  };

  const committeeResult = await ddb.query(params).promise();

  if (committeeResult.Count == 1) {
    const callBacks = [];

    for (let subcommittee of committeeResult.Items[0].subcommittees.SS) {
      callBacks.push(getCommitteeName(subcommittee));
    }

    Promise.all(callBacks).then((data, err) => {
      if (err) {
        console.err(err);
      }

      const committeeObjects = [];

      data.forEach((items) => {
        items.Items.forEach((element) => {
          committeeObjects.push({
            committeeID: element.committee_id.S,
            committeeName: element.name.S,
          });
        });
      });

      res.status(200).json({
        status: 'success',
        committees: committeeObjects,
        committeeName: committeeResult.Items[0].name.S,
      });
    });
  } else {
    res.status(400).json({
      status: 'error: Committee ID not found',
    });
  }
});

exports.getMembers = catchAsync(async (req, res, next) => {
  const { committeeID } = req.params;

  if (!committeeID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Committee',
    KeyConditionExpression: 'committee_id = :c',
    ExpressionAttributeNames: {
      '#committeeName': 'name',
    },
    ProjectionExpression: 'currentMembers, #committeeName',
    ExpressionAttributeValues: {
      ':c': { S: committeeID },
    },
  };

  const committeeResult = await ddb.query(params).promise();

  if (committeeResult.Count == 1) {
    const callBacks = [];

    for (let member of committeeResult.Items[0].currentMembers.SS) {
      callBacks.push(getMember(member));
    }

    Promise.all(callBacks).then((data, err) => {
      if (err) {
        console.err(err);
      }

      const members = [];

      data.forEach((items) => {
        items.Items.forEach((element) => {
          let info = {
            bioguideID: element.bioguide_id.S,
            chamber: element.chamber.S,
            firstName: element.first_name.S,
            lastName: element.last_name.S,
            party: element.party.S,
            position: getPosition(element.chamber.S, element.state.S),
            state: stateCodes[element.state.S],
          };

          if (element.district.S !== '@') {
            info.district = element.district.S;
          }

          members.push(info);
        });
      });

      res.status(200).json({
        status: 'success',
        name:
          committeeResult.Items[0].name.S.charAt(0).toUpperCase() +
          committeeResult.Items[0].name.S.slice(1),
        currentMembers: members,
      });
    });
  } else {
    res.status(400).json({
      status: 'error: Committee ID not found',
    });
  }
});

exports.getCommittee = catchAsync(async (req, res, next) => {
  const { committeeID } = req.params;

  if (!committeeID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Committee',
    KeyConditionExpression: 'committee_id = :c',
    ExpressionAttributeNames: {
      '#urlValue': 'url',
      '#committeeName': 'name',
    },
    ProjectionExpression:
      'subcommittee, currentMembers, #urlValue, #committeeName, subcommittees',
    ExpressionAttributeValues: {
      ':c': { S: committeeID },
    },
  };

  const committeeResult = await ddb.query(params).promise();

  if (committeeResult.Count == 1) {
    res.status(200).json({
      status: 'success',
      committeeID,
      name:
        committeeResult.Items[0].name.S.charAt(0).toUpperCase() +
        committeeResult.Items[0].name.S.slice(1),
      subcommittee: committeeResult.Items[0].subcommittee.S,
      currentMembers: committeeResult.Items[0].currentMembers.SS,
      url: committeeResult.Items[0].url ? committeeResult.Items[0].url.S : '',
      subcommittees: committeeResult.Items[0].subcommittees
        ? committeeResult.Items[0].subcommittees.SS
        : [],
    });
  } else {
    res.status(400).json({
      status: 'error: Committee ID not found',
    });
  }
});
