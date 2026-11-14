// Broad, rounded city-centre reference points for organizer-selected Atlas markers.
// Choosing a city is explicit user action; never infer a campaign's location.
export const US_CITY_CENTERS = Object.freeze([
  {id:"seattle",label:"Seattle area, Washington",lat:47.6,lng:-122.3},
  {id:"portland",label:"Portland area, Oregon",lat:45.5,lng:-122.7},
  {id:"san-francisco",label:"San Francisco area, California",lat:37.8,lng:-122.4},
  {id:"los-angeles",label:"Los Angeles area, California",lat:34.1,lng:-118.2},
  {id:"san-diego",label:"San Diego area, California",lat:32.7,lng:-117.2},
  {id:"las-vegas",label:"Las Vegas area, Nevada",lat:36.2,lng:-115.1},
  {id:"phoenix",label:"Phoenix area, Arizona",lat:33.4,lng:-112.1},
  {id:"denver",label:"Denver area, Colorado",lat:39.7,lng:-105.0},
  {id:"dallas",label:"Dallas area, Texas",lat:32.8,lng:-96.8},
  {id:"austin",label:"Austin area, Texas",lat:30.3,lng:-97.7},
  {id:"houston",label:"Houston area, Texas",lat:29.8,lng:-95.4},
  {id:"minneapolis",label:"Minneapolis area, Minnesota",lat:45.0,lng:-93.3},
  {id:"chicago",label:"Chicago area, Illinois",lat:41.9,lng:-87.6},
  {id:"detroit",label:"Detroit area, Michigan",lat:42.3,lng:-83.0},
  {id:"nashville",label:"Nashville area, Tennessee",lat:36.2,lng:-86.8},
  {id:"atlanta",label:"Atlanta area, Georgia",lat:33.7,lng:-84.4},
  {id:"orlando",label:"Orlando area, Florida",lat:28.5,lng:-81.4},
  {id:"miami",label:"Miami area, Florida",lat:25.8,lng:-80.2},
  {id:"new-orleans",label:"New Orleans area, Louisiana",lat:30.0,lng:-90.1},
  {id:"washington-dc",label:"Washington, D.C. area",lat:38.9,lng:-77.0},
  {id:"philadelphia",label:"Philadelphia area, Pennsylvania",lat:40.0,lng:-75.2},
  {id:"new-york",label:"New York City area, New York",lat:40.7,lng:-74.0},
  {id:"boston",label:"Boston area, Massachusetts",lat:42.4,lng:-71.1},
  {id:"anchorage",label:"Anchorage area, Alaska",lat:61.2,lng:-149.9},
  {id:"honolulu",label:"Honolulu area, Hawaii",lat:21.3,lng:-157.9},
]);
export function selectUSCity(id) {
  return US_CITY_CENTERS.find(city=>city.id===id) || null;
}
