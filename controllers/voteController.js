const AWS = require('aws-sdk');
const https = require('https');
const catchAsync = require('../utils/catchAsync');
const { getVoteValue } = require('../utils/utils');

AWS.config.update({
  region: 'us-east-2',
});

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

const getLegislatorChamberParams = (legislatorID) => {
  return {
    TableName: 'Legislator',
    KeyConditionExpression: 'bioguide_id = :b',
    ProjectionExpression: 'chamber',
    ExpressionAttributeValues: {
      ':b': { S: legislatorID },
    },
  };
};

const getChamberVotedParams = (chamber, lastKey) => {
  const params = {
    TableName: 'Vote',
    IndexName: 'chamber-voted_at-index',
    KeyConditionExpression: 'chamber = :c',
    ExpressionAttributeNames: {
      '#resultValue': 'result',
    },
    ProjectionExpression:
      'chamber, roll_id, bill_title, individualVotes, question, #resultValue',
    ExpressionAttributeValues: {
      ':c': { S: chamber },
    },
    ScanIndexForward: false,
    Limit: 20,
  };

  if (lastKey) {
    params.ExclusiveStartKey = lastKey;
  }

  return params;
};

exports.getLegislatorVotesLastKey = catchAsync(async (req, res, next) => {
  const { legislatorID, rollID, votedAt } = req.params;

  if (!legislatorID || !rollID || !votedAt) {
    return res.sendStatus(400);
  }

  const chamberResult = await ddb
    .query(getLegislatorChamberParams(legislatorID))
    .promise();
  const chamber = chamberResult.Items[0].chamber.S.toLowerCase();

  params = getChamberVotedParams(chamber, {
    chamber: { S: chamber },
    roll_id: { S: rollID },
    voted_at: { S: votedAt },
  });

  voteObject = await getVotes(legislatorID, params);

  const dataObject = {
    votes: voteObject.votes,
  };

  if (voteObject.lastEvaluatedKey) {
    dataObject.lastEvaluatedKey = {
      rollID: voteObject.lastEvaluatedKey.rollID,
      votedAt: voteObject.lastEvaluatedKey.votedAt,
    };
  }

  res.status(200).json({
    status: 'success',
    data: dataObject,
  });
});

const getVotes = async (legislatorID, params) => {
  const votesResult = await ddb.query(params).promise();
  let individualVote;

  const votes = [];

  for (let voteInfo of votesResult.Items) {
    for (let indiv of voteInfo.individualVotes.SS) {
      if (indiv.split('@')[0] === legislatorID) {
        individualVote = indiv.split('@')[4];
        break;
      }
    }

    const voteText = getVoteValue(individualVote);

    votes.push({
      chamber: voteInfo.chamber.S,
      rollID: voteInfo.roll_id.S,
      billTitle: voteInfo.bill_title.S,
      question: voteInfo.question.S,
      result: voteInfo.result.S,
      vote: voteText,
    });
  }

  const legisParams = {
    TableName: 'Legislator',
    KeyConditionExpression: 'bioguide_id = :b',
    ProjectionExpression: 'last_name, first_name',
    ExpressionAttributeValues: {
      ':b': { S: legislatorID },
    },
  };

  const legislatorResult = await ddb.query(legisParams).promise();
  const legislator = legislatorResult.Items[0];

  const dataObject = {
    votes,
    name: `${legislator.first_name.S} ${legislator.last_name.S}`,
  };

  if (votesResult.LastEvaluatedKey) {
    dataObject.lastEvaluatedKey = {
      rollID: votesResult.LastEvaluatedKey.roll_id.S,
      votedAt: votesResult.LastEvaluatedKey.voted_at.S,
    };
  }
  return dataObject;
};

exports.getLegislatorVotes = catchAsync(async (req, res, next) => {
  const { legislatorID } = req.params;

  if (!legislatorID) {
  }

  const chamberResult = await ddb
    .query(getLegislatorChamberParams(legislatorID))
    .promise();

  voteObject = await getVotes(
    legislatorID,
    getChamberVotedParams(chamberResult.Items[0].chamber.S.toLowerCase())
  );

  const dataObject = {
    status: 'success',
    votes: voteObject.votes,
    name: voteObject.name,
  };

  if (voteObject.lastEvaluatedKey) {
    dataObject.lastEvaluatedKey = {
      chamber: voteObject.lastEvaluatedKey.chamber,
      rollID: voteObject.lastEvaluatedKey.rollID,
      votedAt: voteObject.lastEvaluatedKey.votedAt,
    };
  }

  res.status(200).json(dataObject);
});

exports.getVoteForBillIDLastKey = catchAsync(async (req, res, next) => {
  const { billID, rollID, votedAt } = req.params;

  if (!billID || !rollID || !votedAt) {
    return res.sendStatus(400);
  }

  const params = getVoteForBillIDParams(billID);
  params.ExclusiveStartKey = {
    roll_id: { S: rollID },
    voted_at: { S: votedAt },
    bill_id: { S: billID },
  };

  const voteResult = await ddb.query(params).promise();
  const votes = getVotesInd(voteResult.Items);

  const voteObject = {
    status: 'success',
    votes,
  };

  if (voteResult.LastEvaluatedKey) {
    voteObject.lastEvaluatedKey = {
      rollID: voteResult.LastEvaluatedKey.roll_id.S,
      votedAt: voteResult.LastEvaluatedKey.voted_at.S,
      billID: billID,
    };
  }

  res.status(200).json(voteObject);
});

const getVoteForBillIDParams = (billID) => {
  return {
    TableName: 'Vote',
    IndexName: 'bill_id-voted_at-index',
    KeyConditionExpression: 'bill_id = :b',
    ExpressionAttributeNames: {
      '#resultValue': 'result',
    },
    ProjectionExpression:
      'bill_title,chamber,democraticVotes,independentVotes,republicanVotes,individualVotes,question,#resultValue,voted_at,roll_id',
    ScanIndexForward: false,
    ExpressionAttributeValues: {
      ':b': { S: billID },
    },
    Limit: 20,
  };
};

const getVotesInd = (items) => {
  const votes = [];

  for (let vote of items) {
    const democraticVotes = vote.democraticVotes.S.split('@');
    const republicanVotes = vote.republicanVotes.S.split('@');
    const independentVotes = vote.independentVotes.S.split('@');
    const individualVotes = vote.individualVotes.SS;

    const individualVotesArray = [];

    for (let individualVote of individualVotes) {
      const tempArray = individualVote.split('@');
      const voteValue = getVoteValue(tempArray[4]);

      indVoteObject = {
        bioguideID: tempArray[0],
        legislatorName: tempArray[1],
        party: tempArray[2],
        state: tempArray[3],
        vote: voteValue,
      };

      if (tempArray.length === 5) {
        indVoteObject.district = tempArray[4];
      }

      individualVotesArray.push(indVoteObject);
    }

    votes.push({
      billTitle: vote.bill_title.S,
      chamber: vote.chamber.S,
      question: vote.question.S,
      result: vote.result.S,
      rollID: vote.roll_id.S,
      votedAt: vote.voted_at.S,
      democraticVotes: {
        Yea: democraticVotes[0],
        Nay: democraticVotes[1],
        NotVoting: democraticVotes[2],
        Present: democraticVotes[3],
      },
      republicanVotes: {
        Yea: republicanVotes[0],
        Nay: republicanVotes[1],
        NotVoting: republicanVotes[2],
        Present: republicanVotes[3],
      },
      independentVotes: {
        Yea: independentVotes[0],
        Nay: independentVotes[1],
        NotVoting: independentVotes[2],
        Present: independentVotes[3],
      },
      individualVotes: individualVotesArray,
    });
  }

  return votes;
};

const getVotesAllParams = (lastKey) => {
  const params = {
    TableName: 'Vote',
    IndexName: 'blank-voted_at-index',
    KeyConditionExpression: 'blank = :b',
    ExpressionAttributeNames: {
      '#resultValue': 'result',
    },
    ProjectionExpression:
      'bill_title, chamber, question, #resultValue, roll_id',
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

exports.getVotesAllLastKey = catchAsync(async (req, res, next) => {
  const { rollID, votedAt } = req.params;

  if (!rollID || !votedAt) {
    return res.sendStatus(400);
  }

  params = getVotesAllParams({
    roll_id: { S: rollID },
    voted_at: { S: votedAt },
    blank: { S: ' ' },
  });

  const votes = [];
  const voteResult = await ddb.query(params).promise();

  if (voteResult.Items.length > 0) {
    voteResult.Items.forEach((vote) => {
      votes.push({
        billTitle: vote.bill_title.S,
        chamber: vote.chamber.S,
        rollID: vote.roll_id.S,
        question: vote.question.S,
        result: vote.result.S,
      });
    });

    let object = {
      status: 'success',
      votes,
    };

    if (voteResult.LastEvaluatedKey) {
      object.lastEvaluatedKey = {
        rollID: voteResult.LastEvaluatedKey.roll_id.S,
        votedAt: voteResult.LastEvaluatedKey.voted_at.S,
      };
    }
    res.status(200).json(object);
  } else {
    res.status(400).json({
      status: 'error',
    });
  }
});

exports.getVotesAll = catchAsync(async (req, res, next) => {
  params = getVotesAllParams();

  const votes = [];
  const voteResult = await ddb.query(params).promise();

  if (voteResult.Items.length > 0) {
    voteResult.Items.forEach((vote) => {
      votes.push({
        billTitle: vote.bill_title.S,
        chamber: vote.chamber.S,
        rollID: vote.roll_id.S,
        question: vote.question.S,
        result: vote.result.S,
      });
    });

    let object = {
      status: 'success',
      votes,
    };

    if (voteResult.LastEvaluatedKey) {
      object.lastEvaluatedKey = {
        rollID: voteResult.LastEvaluatedKey.roll_id.S,
        votedAt: voteResult.LastEvaluatedKey.voted_at.S,
      };
    }
    res.status(200).json(object);
  } else {
    res.status(400).json({
      status: 'error',
    });
  }
});

exports.getVoteForBillID = catchAsync(async (req, res, next) => {
  const { billID } = req.params;

  if (!billID) {
    return res.sendStatus(400);
  }

  const params = getVoteForBillIDParams(billID);
  const voteResult = await ddb.query(params).promise();
  const votes = getVotesInd(voteResult.Items);

  const voteObject = {
    status: 'success',
    votes,
  };

  if (voteResult.LastEvaluatedKey) {
    voteObject.lastEvaluatedKey = {
      rollID: voteResult.LastEvaluatedKey.roll_id.S,
      votedAt: voteResult.LastEvaluatedKey.voted_at.S,
      billID: billID,
    };
  }

  res.status(200).json(voteObject);
});

exports.getVoteForNominationID = catchAsync(async (req, res, next) => {
  const { nominationID } = req.params;

  if (!nominationID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Vote',
    IndexName: 'nomination_id-voted_at-index',
    KeyConditionExpression: 'nomination_id = :n',
    ExpressionAttributeNames: {
      '#resultValue': 'result',
    },
    ProjectionExpression:
      'bill_title,chamber,roll_id,democraticVotes,independentVotes,republicanVotes,individualVotes,question,#resultValue,voted_at',
    ScanIndexForward: false,
    ExpressionAttributeValues: {
      ':n': { S: nominationID },
    },
  };

  const voteResult = await ddb.query(params).promise();
  const votes = getVotesInd(voteResult.Items);
  const voteObject = {
    status: 'success',
    votes,
  };

  res.status(200).json(voteObject);
});

exports.getVoteDetail = catchAsync(async (req, res, next) => {
  const { rollID } = req.params;

  if (!rollID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Vote',
    KeyConditionExpression: 'roll_id = :r',
    ProjectionExpression:
      'democraticVotes,independentVotes,republicanVotes,individualVotes,question,bill_id,nomination_id',
    ExpressionAttributeValues: {
      ':r': { S: rollID },
    },
  };

  const voteResult = await ddb.query(params).promise();

  res.status(200).json({
    status: 'success',
    voteDetail: {
      billID: voteResult.Items[0].bill_id ? voteResult.Items[0].bill_id.S : '',
      nominationID: voteResult.Items[0].nomination_id
        ? voteResult.Items[0].nomination_id.S
        : '',
      individualVotes: voteResult.Items[0].individualVotes.SS,
      democraticVotes: voteResult.Items[0].democraticVotes.S,
      republicanVotes: voteResult.Items[0].republicanVotes.S,
      independentVotes: voteResult.Items[0].independentVotes.S,
    },
  });
});
