const validateLocation = (location) => {
    return location && location.latitude && location.longitude;
};

const calculateDistance = (loc1, loc2) => {
    // Simplified distance calculation (mocked)
    const R = 6371e3; // Earth's radius in meters
    const lat1 = loc1.latitude * Math.PI / 180;
    const lat2 = loc2.latitude * Math.PI / 180;
    const deltaLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const deltaLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c) / 1000; // Distance in kilometers
};

module.exports = { validateLocation, calculateDistance };