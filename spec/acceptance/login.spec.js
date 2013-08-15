var webdriver = require('selenium-webdriver');
var By = webdriver.By;

//TODO:  add helper for creating webdriver
var driver = new webdriver.Builder().
        usingServer('http://127.0.0.1:4444/wd/hub').
        withCapabilities({'browserName': 'chrome'}).
        build();

  describe("User login", function() {

    it ("should login the user", function(done) {
      driver.get('http://localhost:8080/index.html').then(function(){
        //TODO:  setup user before test, don't assume user exists
        driver.findElement(By.id('jid')).sendKeys('test4');
        driver.findElement(By.id('pass')).sendKeys('password');
        //TODO:  add "id" for button instead of tagName
        driver.findElement(By.tagName('button')).click();
        driver.wait(function(){
          //TODO:  check for error condition not just success
          return driver.findElement(By.id('button-config')).isDisplayed();
        }, 10000);
        driver.findElement(By.id('loggedin_user')).getText().then(function(t){ 
          expect(t).toBe('test4');
          driver.quit();
          done();
        });
      });
  });
});
