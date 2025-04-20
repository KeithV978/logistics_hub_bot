function userGreeting(user) {
    const currentHour = new Date().getHours();
    
    if (currentHour >= 12 && currentHour < 18) {
      return "Good Afternoon" + user;
    } else if (currentHour >= 18 || currentHour < 5) {
      return "Good Evening" + user;
    } else {
      return "Good Morning" + user;
    }
  }

  module.exports = userGreeting;
   