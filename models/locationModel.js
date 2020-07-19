const mongoose = require('mongoose');

const polygonSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Polygon'],
  },
  coordinates: {
    type: [[[Number]]],
  },
});

const districtSchema = new mongoose.Schema(
  {
    name: String,
    geometry: polygonSchema,
  },
  { versionKey: false }
);

const Location = mongoose.model('Location', districtSchema);

module.exports = Location;
