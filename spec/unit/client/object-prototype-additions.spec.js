describe("The Object prototype", function() {
  /*
   * Make sure the forOwn function exists.
   * Make sure it loops through keys in an object.
   * Make sure it returns all keys that are proper attributes.
   * Make sure it doesn't return some things in the prototype chain.
   */
  it("contains a new function 'forOwn'", function() {
	var keys = [];
	var testObject = {
	  "myNumber": 1,
	  "myString": "happy",
	  "myObject": {'answer': 42},
	  "myArray": [1, 2, 3],
	  "myNull": null,
	  "myBool": true
	};

	// Manipulate the prototype two different ways.
	// For some reason, testObject.prototype is undefined, but testObject.__proto__ is not.
	Object.defineProperty(testObject, 'dontFindThis', function() { return true; });
	testObject.__proto__.dontFindThisEither = true;

    expect(typeof Object.forOwn).toBe('function');

	testObject.forOwn(function (value, key) {
      keys.push(key);
	});

	expect(keys).not.toContain('dontFindThis');
	expect(keys).not.toContain('dontFindThisEither');
	expect(keys).not.toContain('toString');
	expect(keys).toContain('myNumber');
	expect(keys).toContain('myString');
	expect(keys).toContain('myObject');
	expect(keys).toContain('myArray');
	expect(keys).toContain('myNull');
	expect(keys).toContain('myBool');
  });

  /*
   * Make sure the isNumber function exists.
   * Make sure it can handle all kinds of input.
   * Make sure it returns true for every finite number.
   * Make sure it returns false for every non-number and Infinity.
   * TODO: Figure out how to test Infinity.
   */
  it("contains a new function 'isNumber'", function() {
    var func = new Function();
	expect(typeof Object.isNumber).toBe('function');
	expect(Object.isNumber(1)).toEqual(true);
	expect(Object.isNumber(189098987)).toEqual(true);
	expect(Object.isNumber(3454/33453)).toEqual(true);
	expect(Object.isNumber(3454.3454)).toEqual(true);
	expect(Object.isNumber(null)).toEqual(false);
	expect(Object.isNumber(undefined)).toEqual(false);
	expect(Object.isNumber(Object)).toEqual(false);
	expect(Object.isNumber([1, 2, 3])).toEqual(false);
	expect(Object.isNumber(new Object())).toEqual(false);
	expect(Object.isNumber(func)).toEqual(false);
	expect(Object.isNumber("happy octopus")).toEqual(false);
	expect(Object.isNumber("5")).toEqual(false);
  });

  /*
   * Make sure the publicize function exists.
   * Make sure it accepts a function, adds it to this, and returns it.
   */
  it("contains a new function 'publicize'", function() {
    var myInstance = new Function();
	expect(typeof Object.publicize).toBe('function');
	var aNewFunction = myInstance.publicize('aNewFunction', function() {
		return "Hello, world!";
	});
	expect(aNewFunction).toEqual(myInstance.aNewFunction);
  });
});
