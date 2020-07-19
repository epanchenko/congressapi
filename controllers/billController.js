const AWS = require('aws-sdk');
const zlib = require('zlib');

const catchAsync = require('../utils/catchAsync');

const { months } = require('../utils/utils');

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

exports.getBillSummary = catchAsync(async (req, res, next) => {
  const { billID } = req.params;

  if (!billID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Bill',
    KeyConditionExpression: 'bill_id = :b',
    ProjectionExpression: 'bill_title,summary',
    ExpressionAttributeValues: {
      ':b': { S: billID },
    },
  };

  const bill = await ddb.query(params).promise();

  if (bill.Count === 1) {
    const summary = zlib.gunzipSync(bill.Items[0].summary.B).toString('utf8');

    res.status(200).json({
      status: 'success',
      billID,
      billTitle: bill.Items[0].bill_title.S,
      summary,
    });
  } else {
    res.status(400).json({
      status: 'error',
      error: 'Invalid bill id.',
    });
  }
});

exports.getActions = catchAsync(async (req, res, next) => {
  const { billID } = req.params;

  if (!billID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Bill',
    KeyConditionExpression: 'bill_id = :b',
    ProjectionExpression: 'bill_title,actions,bill_id',
    ExpressionAttributeValues: {
      ':b': { S: billID },
    },
  };

  const bill = await ddb.query(params).promise();

  if (bill.Count === 1) {
    const actions = bill.Items[0].actions ? bill.Items[0].actions.BS : {};
    const actionsArray = [];

    if (Object.keys(actions).length > 0) {
      for (let action of actions) {
        const actionString = zlib.gunzipSync(action).toString('utf8');
        const tempArray = actionString.split('@');
        const actionDate = new Date(tempArray[2] + 'T20:00:00');

        actionsArray.push({
          id: parseInt(tempArray[0]),
          chamber: tempArray[1],
          date: `${
            months[actionDate.getMonth()]
          } ${actionDate.getDate()}, ${actionDate.getFullYear()}`,
          actionText: tempArray[3],
        });
      }
    }

    actionsArray.sort((a, b) => parseInt(b.id) - parseInt(a.id));

    res.status(200).json({
      status: 'success',
      actions: actionsArray,
      billID: bill.Items[0].bill_id.S,
      billTitle: bill.Items[0].bill_title.S,
    });
  } else {
    res.status(400).json({
      status: 'error',
      error: 'Invalid bill id.',
    });
  }
});

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

exports.getCommittees = catchAsync(async (req, res, next) => {
  const { billID } = req.params;

  if (!billID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Bill',
    KeyConditionExpression: 'bill_id = :b',
    ProjectionExpression: 'bill_title,committeeIDs,bill_id',
    ExpressionAttributeValues: {
      ':b': { S: billID },
    },
  };

  const bill = await ddb.query(params).promise();

  if (bill.Count === 1) {
    const committees = bill.Items[0].committeeIDs
      ? bill.Items[0].committeeIDs.SS
      : [];
    const committeeObjects = [];

    if (committees.length > 0) {
      const callBacks = [];

      for (let committee of committees) {
        callBacks.push(getCommitteeName(committee));
      }

      Promise.all(callBacks).then((data, err) => {
        if (err) {
          console.err(err);
        }

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
          billTitle: bill.Items[0].bill_title.S,
          billID: bill.Items[0].bill_id.S,
        });
      });
    }
  } else {
    res.status(400).json({
      status: 'error',
      error: 'Invalid bill id.',
    });
  }
});

exports.getAmendments = catchAsync(async (req, res, next) => {
  const { billID } = req.params;

  if (!billID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Bill',
    KeyConditionExpression: 'bill_id = :b',
    ProjectionExpression: 'bill_title,amendments,bill_id',
    ExpressionAttributeValues: {
      ':b': { S: billID },
    },
  };

  const bill = await ddb.query(params).promise();

  if (bill.Count === 1) {
    const amendments = bill.Items[0].amendments
      ? bill.Items[0].amendments.BS
      : {};
    const amendmentsArray = [];

    if (Object.keys(amendments).length > 0) {
      for (let amendment of amendments) {
        const amendmentString = zlib.gunzipSync(amendment).toString('utf8');
        const tempArray = amendmentString.split('@');
        const introducedDate = new Date(tempArray[1] + 'T20:00:00');
        const lastMajorActionDate = new Date(tempArray[4] + 'T20:00:00');

        amendmentsArray.push({
          number: parseInt(tempArray[0]),
          congressdotgovURL: tempArray[3],
          introducedDate: `${
            months[introducedDate.getMonth()]
          } ${introducedDate.getDate()}, ${introducedDate.getFullYear()}`,
          lastMajorActionDate: `${
            months[lastMajorActionDate.getMonth()]
          } ${lastMajorActionDate.getDate()}, ${lastMajorActionDate.getFullYear()}`,
          lastMajorAction: tempArray[5],
          sponsor: tempArray[6],
          title: tempArray[2],
        });
      }
    }

    amendmentsArray.sort((a, b) => parseInt(b.number) - parseInt(a.number));

    res.status(200).json({
      status: 'success',
      amendments: amendmentsArray,
      billTitle: bill.Items[0].bill_title.S,
      billID: bill.Items[0].bill_id.S,
    });
  } else {
    res.status(400).json({
      status: 'error',
      error: 'Invalid bill id.',
    });
  }
});

exports.getBillID = catchAsync(async (req, res, next) => {
  const { billID } = req.params;

  if (!billID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Bill',
    KeyConditionExpression: 'bill_id = :b',
    ProjectionExpression:
      'bill_title, summary,congress,introduced_date,latest_major_action_date,actions,committeeIDs,amendments,text_url',
    ExpressionAttributeValues: {
      ':b': { S: billID },
    },
  };

  const bill = await ddb.query(params).promise();

  if (bill.Count === 1) {
    const summary = zlib.gunzipSync(bill.Items[0].summary.B).toString('utf8');

    const actions = bill.Items[0].actions ? bill.Items[0].actions.BS : {};
    const actionsArray = [];
    const amendments = bill.Items[0].amendments
      ? bill.Items[0].amendments.BS
      : {};
    const amendmentsArray = [];

    if (Object.keys(actions).length > 0) {
      for (let action of actions) {
        const actionString = zlib.gunzipSync(action).toString('utf8');
        const tempArray = actionString.split('@');
        const actionDate = new Date(tempArray[2] + 'T20:00:00');

        actionsArray.push({
          id: parseInt(tempArray[0]),
          chamber: tempArray[1],
          date: `${
            months[actionDate.getMonth()]
          } ${actionDate.getDate()}, ${actionDate.getFullYear()}`,
          actionText: tempArray[3],
        });
      }
    }

    if (Object.keys(amendments).length > 0) {
      for (let amendment of amendments) {
        const amendmentString = zlib.gunzipSync(amendment).toString('utf8');
        const tempArray = amendmentString.split('@');
        const introducedDate = new Date(tempArray[1] + 'T20:00:00');
        const lastMajorActionDate = new Date(tempArray[4] + 'T20:00:00');

        amendmentsArray.push({
          number: parseInt(tempArray[0]),
          congressdotgovURL: tempArray[3],
          introducedDate: `${
            months[introducedDate.getMonth()]
          } ${introducedDate.getDate()}, ${introducedDate.getFullYear()}`,
          lastMajorActionDate: `${
            months[lastMajorActionDate.getMonth()]
          } ${lastMajorActionDate.getDate()}, ${lastMajorActionDate.getFullYear()}`,
          lastMajorAction: tempArray[5],
          sponsor: tempArray[6],
          title: tempArray[2],
        });
      }
    }

    actionsArray.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    amendmentsArray.sort((a, b) => parseInt(b.number) - parseInt(a.number));

    const introducedDate = new Date(
      bill.Items[0].introduced_date.S + 'T20:00:00'
    );

    const lastMajorActionDate = new Date(
      bill.Items[0].latest_major_action_date.S + 'T20:00:00'
    );

    res.status(200).json({
      status: 'success',
      actions: actionsArray,
      amendments: amendmentsArray,
      billTitle: bill.Items[0].bill_title.S,
      committees: bill.Items[0].committeeIDs
        ? bill.Items[0].committeeIDs.SS
        : [],
      congress: bill.Items[0].congress.S,
      introduced: `${
        months[introducedDate.getMonth()]
      } ${introducedDate.getDate()}, ${introducedDate.getFullYear()}`,
      latestMajorActionDate: `${
        months[lastMajorActionDate.getMonth()]
      } ${lastMajorActionDate.getDate()}, ${lastMajorActionDate.getFullYear()}`,
      summary,
      textURL: bill.Items[0].text_url ? bill.Items[0].text_url.S : '',
    });
  } else {
    res.status(400).json({
      status: 'error',
      error: 'Invalid bill id.',
    });
  }
});
