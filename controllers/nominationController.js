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

const getAllNominationParams = (lastKey) => {
  const params = {
    TableName: 'Nomination',
    IndexName: 'blank-latest_action_date-index',
    KeyConditionExpression: 'blank = :b',
    ExpressionAttributeNames: {
      '#nomStatus': 'status',
    },
    ProjectionExpression:
      'nomination_id,nominee_description,date_received,latest_action_date,committee_id,congress,#nomStatus,actions',
    ExpressionAttributeValues: {
      ':b': { S: ' ' },
    },
    ScanIndexForward: false,
    Limit: 20,
  };

  if (lastKey) {
    params.ExclusiveStartKey = lastKey;
  }

  return params;
};

const getAllNominationsArray = (items) => {
  const nominations = [];

  for (let nomination of items) {
    const actions = [];

    if (nomination.actions) {
      for (let i = 0; i < nomination.actions.BS.length; i++) {
        const actionText = zlib
          .gunzipSync(nomination.actions.BS[i])
          .toString('utf8');
        const tempArray = actionText.split('@');
        const tempDate = new Date(tempArray[1] + 'T20:00:00');

        actions.push({
          id: parseInt(tempArray[0]),
          date: `${
            months[tempDate.getMonth()]
          } ${tempDate.getDate()}, ${tempDate.getFullYear()}`,
          action: tempArray[2],
        });
      }

      actions.sort((a, b) => a.id - b.id);
    }

    const description = zlib
      .gunzipSync(nomination.nominee_description.B)
      .toString('utf8');
    nominations.push({
      nominationID: nomination.nomination_id.S,
      description,
      dateReceived: nomination.date_received.S,
      latestActionDate: nomination.latest_action_date.S,
      committeeID: nomination.committee_id ? nomination.committee_id.S : '',
      congress: nomination.congress.S,
      status: nomination.status.S,
      actions,
    });
  }

  return nominations;
};

exports.getActions = catchAsync(async (req, res, next) => {
  const { nominationID } = req.params;

  if (!nominationID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Nomination',
    KeyConditionExpression: 'nomination_id = :n',
    ProjectionExpression: 'nominee_description,actions,nomination_id',
    ExpressionAttributeValues: {
      ':n': { S: nominationID },
    },
  };

  const nomination = await ddb.query(params).promise();

  if (nomination.Count === 1) {
    const actions = nomination.Items[0].actions
      ? nomination.Items[0].actions.BS
      : {};
    const actionsArray = [];
    let index = 0;

    if (Object.keys(actions).length > 0) {
      for (let action of actions) {
        const actionString = zlib.gunzipSync(action).toString('utf8');
        const tempArray = actionString.split('@');
        const actionDate = new Date(tempArray[1] + 'T20:00:00');

        actionsArray.push({
          id: actions.length - 1 - +tempArray[0],
          date: `${
            months[actionDate.getMonth()]
          } ${actionDate.getDate()}, ${actionDate.getFullYear()}`,
          action: tempArray[2],
        });

        index++;
      }
    }

    actionsArray.sort((a, b) => parseInt(b.id) - parseInt(a.id));

    res.status(200).json({
      status: 'success',
      actions: actionsArray,
      nominationID: nomination.Items[0].nomination_id.S,
      description: zlib
        .gunzipSync(nomination.Items[0].nominee_description.B)
        .toString('utf8'),
    });
  } else {
    res.status(400).json({
      status: 'error',
      error: 'Invalid nomination id.',
    });
  }
});

exports.getAllNominationsLastKey = catchAsync(async (req, res, next) => {
  const { nominationID, latestActionDate } = req.params;

  if (!nominationID || !latestActionDate) {
    return res.sendStatus(400);
  }

  const nominationsResult = await ddb
    .query(
      getAllNominationParams({
        nomination_id: { S: nominationID },
        blank: { S: ' ' },
        latest_action_date: { S: latestActionDate },
      })
    )
    .promise();
  const nominations = getAllNominationsArray(nominationsResult.Items);

  const object = {
    status: 'success',
    nominations,
  };

  if (nominationsResult.LastEvaluatedKey) {
    object.lastEvaluatedKey = {
      nominationID: nominationsResult.LastEvaluatedKey.nomination_id.S,
      latestActionDate: nominationsResult.LastEvaluatedKey.latest_action_date.S,
    };
  }
  res.status(200).json(object);
});

exports.getAllNominations = catchAsync(async (req, res, next) => {
  const nominationsResult = await ddb.query(getAllNominationParams()).promise();
  const nominations = getAllNominationsArray(nominationsResult.Items);

  const object = {
    status: 'success',
    nominations,
  };

  if (nominationsResult.LastEvaluatedKey) {
    object.lastEvaluatedKey = {
      nominationID: nominationsResult.LastEvaluatedKey.nomination_id.S,
      latestActionDate: nominationsResult.LastEvaluatedKey.latest_action_date.S,
    };
  }
  res.status(200).json(object);
});

exports.getNominationID = catchAsync(async (req, res, next) => {
  const { nominationID } = req.params;

  if (!nominationID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Nomination',
    KeyConditionExpression: 'nomination_id = :n',
    ExpressionAttributeNames: {
      '#nomStatus': 'status',
    },
    ProjectionExpression:
      'nomination_id,nominee_description,date_received,latest_action_date,committee_id,congress,#nomStatus,actions',
    ExpressionAttributeValues: {
      ':n': { S: nominationID },
    },
    Limit: 1,
  };

  const nominationsResult = await ddb.query(params).promise();
  if (nominationsResult.Count === 1) {
    const nomination = getAllNominationsArray(nominationsResult.Items)[0];
    res.status(200).json({
      status: 'success',
      nomination,
    });
  } else {
    res.status(400).json({
      status: 'error: Invalid bill id',
    });
  }
});
