var DOMAIN = 'mercury.digiumlabs.com';
var client;
var username = 'test4';
var resource;
var jabberid;
var password = 'password';

describe("Connection", function(){

  beforeEach(function(){
    client = webrtc.Client();
  });

  it("not connected", function(){
    expect(client.isConnected()).toBe(false);
  });

  it("connected", function(){
    client.connect();
    expect(client.isConnected()).toBe(true);
  });

  it("disconnected", function(){
    client.connect();
    client.disconnect();
    expect(client.isConnected()).toBe(false);
  });
});

describe("Authentication", function() {

  beforeEach(function(){
    client = webrtc.Client();
    client.connect();
    resource = 'mercury_' +  Math.random().toString(36).substring(2, 16);
    jabberid = username + '@' + DOMAIN + '/' + resource;
  });

  it("not authenticated", function(){
    expect(client.isLoggedIn()).toBe(false);
  });

  //disabled until userSessions and isLoggedIn are refactored
  //isLoggedIn checks userSession, but login does not add a userSession
  it("authenticated", function(){
    var flag, user;
    runs(function(){
      flag = false
      var userPromise = client.login(jabberid, password);
      userPromise.then(function(u){
        user = u;
        flag = true;
      })
    });
    
    waitsFor(function(){
      return flag;
    }, "user login to complete")

    runs(function(){
      expect(client.isLoggedIn()).toBe(true);
    });
      
  });

  it("should call error function when given wrong credentials", function(done){
    var flag, error;
    runs(function(){
      flag = false;
      var userPromise = client.login(jabberid, 'badpassword');
      userPromise.then(function(user){
        console.log("u2ser:  " + user);
        }, function(e){
          error = e;
          flag = true;
      });
    });

    waitsFor(function(){
      return flag;
    }, "receive error message");

    runs(function(){
      expect(error).toBeDefined();
    });


  });
});
