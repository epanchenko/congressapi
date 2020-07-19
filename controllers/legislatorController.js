const AWS = require('aws-sdk');
const https = require('https');
const Location = require('../models/locationModel');
const catchAsync = require('../utils/catchAsync');

const {
  getPosition,
  stateCodes,
  fieldSorter,
  months,
} = require('../utils/utils');

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

function getLocDistResults(district) {
  let districtName;

  if (district.name.indexOf('-') === -1) {
    districtName = '@';
  } else {
    districtName = district.name.split('-')[1];
  }

  const params = {
    TableName: 'Legislator',
    IndexName: 'state-district-index',
    KeyConditionExpression: '#statename = :s and district = :d',
    ExpressionAttributeNames: {
      '#statename': 'state',
    },
    ProjectionExpression: 'bioguide_id, district, #statename',
    ExpressionAttributeValues: {
      ':s': { S: district.name.substring(0, 2) },
      ':d': { S: districtName },
    },
  };

  return ddb.query(params).promise();
}

exports.getLocDist = catchAsync(async (req, res, next) => {
  const { lnglat } = req.params;
  const [lng, lat] = lnglat.split(',');

  if (!lat || !lng) {
    return res.sendStatus(400);
  }

  districts = await Location.find(
    {
      geometry: {
        $geoIntersects: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
        },
      },
    },
    { name: 1, _id: 0 }
  );

  const people = [];
  const callBacks = [];

  for (let district of districts) {
    callBacks.push(getLocDistResults(district));
  }

  Promise.all(callBacks).then((data, err) => {
    if (err) {
      console.err(err);
    }

    data.forEach((items) => {
      items.Items.forEach((element) => {
        const result = {};

        if (element.district.S === '@') {
          result.district = element.state.S;
        } else {
          result.district = `${element.state.S}-${element.district.S}`;
        }

        result.bioguideID = element.bioguide_id.S;

        people.push(result);
      });
    });

    res.status(200).json({
      status: 'success',
      reps: people,
    });
  });
});

exports.getAllLegislators = catchAsync(async (req, res, next) => {
  const params = {
    TableName: 'Legislator',
    ExpressionAttributeNames: {
      '#statename': 'state',
    },
    ProjectionExpression:
      'bioguide_id, last_name, first_name, party, #statename, district, chamber',
  };

  const people = [];

  ddb.scan(params, (err, data) => {
    if (err) {
      console.err('Error', err);
    } else {
      data.Items.forEach((element) => {
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

        people.push(info);
      });

      people.sort(fieldSorter(['state', 'lastName']));

      res.status(200).json({
        status: 'success',
        legislators: people,
      });
    }
  });
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
  const { legislatorID } = req.params;

  if (!legislatorID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Legislator',
    KeyConditionExpression: 'bioguide_id = :b',
    ProjectionExpression: 'committees, last_name, first_name',
    ExpressionAttributeValues: {
      ':b': { S: legislatorID },
    },
  };

  const legislatorResult = await ddb.query(params).promise();

  if (legislatorResult.Count === 1) {
    const committees = legislatorResult.Items[0].committees
      ? legislatorResult.Items[0].committees.SS
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
          name: `${legislatorResult.Items[0].first_name.S} ${legislatorResult.Items[0].last_name.S}`,
        });
      });
    } else {
      res.status(200).json({
        status: 'success',
        committees: [],
        name: `${legislatorResult.Items[0].first_name.S} ${legislatorResult.Items[0].last_name.S}`,
      });
    }
  } else {
    res.status(400).json({
      status: 'Bioguide id not found',
    });
  }
});

exports.getDistrictCoordinates = catchAsync(async (req, res, next) => {
  const { district } = req.params;

  if (!district) {
    return res.sendStatus(400);
  }

  coordinates = await Location.find(
    { name: district },
    { name: 1, _id: 0, geometry: '2dsphere' }
  );

  res.status(200).json({
    status: 'success',
    data: coordinates[0],
  });
});

exports.getLegislatorByIDSum = catchAsync(async (req, res, next) => {
  const { legislatorID } = req.params;

  if (!legislatorID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Legislator',
    KeyConditionExpression: 'bioguide_id = :b',
    ExpressionAttributeNames: {
      '#statename': 'state',
    },
    ProjectionExpression:
      'bioguide_id, last_name, first_name, party, #statename, district, chamber',
    ExpressionAttributeValues: {
      ':b': { S: legislatorID },
    },
  };

  const legislatorResult = await ddb.query(params).promise();

  if (legislatorResult.Count === 1) {
    const legislator = legislatorResult.Items[0];
    const result = {
      bioguideID: legislator.bioguide_id.S,
      chamber: legislator.chamber.S,
      district: legislator.district.S === '@' ? '' : legislator.district.S,
      firstName: legislator.first_name.S,
      lastName: legislator.last_name.S,
      party: legislator.party.S,
      position: getPosition(legislator.chamber.S, legislator.state.S),
      state: legislator.state.S,
    };

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } else {
    res.status(400).json({
      status: 'Bioguide id not found',
    });
  }
});

exports.getTermsByID = catchAsync(async (req, res, next) => {
  const { legislatorID } = req.params;

  if (!legislatorID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Legislator',
    KeyConditionExpression: 'bioguide_id = :b',
    ProjectionExpression: 'terms, last_name, first_name',
    ExpressionAttributeValues: {
      ':b': { S: legislatorID },
    },
  };

  const legislatorResult = await ddb.query(params).promise();

  if (legislatorResult.Count === 1) {
    const legislator = legislatorResult.Items[0];
    const terms = [];
    legislator.terms.SS.forEach((term) => {
      const termTemp = term.split('@');
      const startDate = new Date(termTemp[0] + 'T20:00:00');
      const endDate = new Date(termTemp[1] + 'T20:00:00');

      terms.push({
        start: `${
          months[startDate.getMonth()]
        } ${startDate.getDate()}, ${startDate.getFullYear()}`,
        end: `${
          months[endDate.getMonth()]
        } ${endDate.getDate()}, ${endDate.getFullYear()}`,
        position: termTemp[2],
      });
    });

    res.status(200).json({
      status: 'success',
      data: {
        terms,
        name: `${legislator.first_name.S} ${legislator.last_name.S}`,
      },
    });
  } else {
    res.status(400).json({
      status: 'Bioguide id not found',
    });
  }
});

exports.getLegislatorByID = catchAsync(async (req, res, next) => {
  const { legislatorID } = req.params;

  if (!legislatorID) {
    return res.sendStatus(400);
  }

  const params = {
    TableName: 'Legislator',
    KeyConditionExpression: 'bioguide_id = :b',
    ExpressionAttributeNames: {
      '#statename': 'state',
      '#urlname': 'url',
    },
    ProjectionExpression:
      'first_name, middle_name, last_name, committees, district, party, #statename, terms, next_election, twitter_account, youtube_account, facebook_account, #urlname, office, phone, chamber, fax',
    ExpressionAttributeValues: {
      ':b': { S: legislatorID },
    },
  };

  const legislatorResult = await ddb.query(params).promise();

  if (legislatorResult.Count === 1) {
    const legislator = legislatorResult.Items[0];
    const terms = [];
    legislator.terms.SS.forEach((term) => {
      const termTemp = term.split('@');
      const startDate = new Date(termTemp[0] + 'T20:00:00');
      const endDate = new Date(termTemp[1] + 'T20:00:00');

      terms.push({
        start: `${
          months[startDate.getMonth()]
        } ${startDate.getDate()}, ${startDate.getFullYear()}`,
        end: `${
          months[endDate.getMonth()]
        } ${endDate.getDate()}, ${endDate.getFullYear()}`,
        position: termTemp[2],
      });
    });

    const result = {
      chamber: legislator.chamber.S,
      committees: legislator.hasOwnProperty('committees')
        ? legislator.committees.SS
        : [],
      district: legislator.district.S === '@' ? '' : legislator.district.S,
      facebookAccount: legislator.hasOwnProperty('facebook_account')
        ? legislator.facebook_account.S
        : '',
      firstName: legislator.first_name.S,
      lastName: legislator.last_name.S,
      location:
        legislator.district.S === '@'
          ? legislator.state.S
          : `${legislator.state.S}-${legislator.district.S}`,
      middleName: legislator.hasOwnProperty('middle_name')
        ? legislator.middle_name.S
        : '',
      nextElection: legislator.hasOwnProperty('next_election')
        ? legislator.next_election.S
        : '',
      office: legislator.hasOwnProperty('office') ? legislator.office.S : '',
      party: legislator.party.S,
      phone: legislator.hasOwnProperty('phone') ? legislator.phone.S : '',
      position: getPosition(legislator.chamber.S, legislator.state.S),
      state: legislator.state.S,
      terms,
      twitterAccount: legislator.hasOwnProperty('twitter_account')
        ? legislator.twitter_account.S
        : '',
      url: legislator.hasOwnProperty('url') ? legislator.url.S : '',
      youtubeAccount: legislator.hasOwnProperty('youtube_account')
        ? legislator.youtube_account.S
        : '',
    };

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } else {
    res.status(400).json({
      status: 'Bioguide id not found',
    });
  }
});
