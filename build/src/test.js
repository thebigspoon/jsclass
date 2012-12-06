JS.Test = new JS.Module('Test', {
  extend: {
    Unit: new JS.Module({}),
    
    asyncTimeout: 10,
    
    filter: function(objects, suffix) {
      return JS.Test.Runner.filter(objects, suffix);
    },
    
    UI: new JS.Module({}),
    
    Reporters: new JS.Module({
      extend: {
        METHODS: ['startRun', 'startSuite', 'startTest',
                  'update', 'addFault',
                  'endTest', 'endSuite', 'endRun'],
        
        _registry: {},
        
        register: function(name, klass) {
          this._registry[name] = klass;
        },
        
        find: function(name) {
          if (!name) return null;
          return this._registry[name] || null;
        }
      }
    }),
    
    addReporter: function(reporter) {
      var current = this.reporter;
      if (!(reporter instanceof JS.Test.Reporters.Composite)) {
        this.reporter = new JS.Test.Reporters.Composite();
        this.reporter.addReporter(current);
      }
      this.reporter.addReporter(reporter);
    },
    
    setReporter: function(reporter, replace) {
      if (this.reporter && replace !== false) return;
      this.reporter = reporter;
    }
  }
});


JS.Test.Unit.extend({
  Observable: new JS.Module({
    addListener: function(channelName, block, context) {
      if (block === undefined) throw new Error('No callback was passed as a listener');
      
      this.channels()[channelName] = this.channels()[channelName] || [];
      this.channels()[channelName].push([block, context]);
      
      return block;
    },
    
    removeListener: function(channelName, block, context) {
      var channel = this.channels()[channelName];
      if (!channel) return;
      
      var i = channel.length;
      while (i--) {
        if (channel[i][0] === block) {
          channel.splice(i,1);
          return block;
        }
      }
      return null;
    },
    
    notifyListeners: function(channelName, args) {
      var args        = JS.array(arguments),
          channelName = args.shift(),
          channel     = this.channels()[channelName];
      
      if (!channel) return 0;
      
      for (var i = 0, n = channel.length; i < n; i++)
        channel[i][0].apply(channel[i][1] || null, args);
      
      return channel.length;
    },
    
    channels: function() {
      return this.__channels__ = this.__channels__ || [];
    }
  })
});


JS.Test.Unit.extend({
  AssertionFailedError: new JS.Class(Error, {
    initialize: function(message) {
      this.message = message.toString();
    }
  }),
  
  Assertions: new JS.Module({
    assertBlock: function(message, block, context) {
      if (typeof message === 'function') {
        context = block;
        block   = message;
        message = null;
      }
      this.__wrapAssertion__(function() {
        if (!block.call(context || null)) {
          message = this.buildMessage(message || 'assertBlock failed');
          throw new JS.Test.Unit.AssertionFailedError(message);
        }
      });
    },
    
    flunk: function(message) {
      this.assertBlock(this.buildMessage(message || 'Flunked'), function() { return false });
    },
    
    assert: function(bool, message) {
      this.__wrapAssertion__(function() {
        this.assertBlock(this.buildMessage(message, '<?> is not true', bool),
                         function() { return bool });
      });
    },
    
    assertEqual: function(expected, actual, message) {
      var fullMessage = this.buildMessage(message, '<?> expected but was\n<?>', expected, actual);
      this.assertBlock(fullMessage, function() {
        return JS.Enumerable.areEqual(expected, actual);
      });
    },
    
    assertNotEqual: function(expected, actual, message) {
      var fullMessage = this.buildMessage(message, '<?> expected not to be equal to\n<?>',
                                                   expected,
                                                   actual);
      this.assertBlock(fullMessage, function() {
        return !JS.Enumerable.areEqual(expected, actual);
      });
    },
    
    assertNull: function(object, message) {
      this.assertEqual(null, object, message);
    },
    
    assertNotNull: function(object, message) {
      var fullMessage = this.buildMessage(message, '<?> expected not to be null', object);
      this.assertBlock(fullMessage, function() { return object !== null });
    },
    
    assertKindOf: function(klass, object, message) {
      this.__wrapAssertion__(function() {
        var type = (!object || typeof klass === 'string') ? typeof object : (object.klass || object.constructor);
        var fullMessage = this.buildMessage(message, '<?> expected to be an instance of\n' +
                                                     '<?> but was\n' +
                                                     '<?>',
                                                     object, klass, type);
        this.assertBlock(fullMessage, function() { return JS.isType(object, klass) });
      });
    },
    
    assertRespondTo: function(object, method, message) {
      this.__wrapAssertion__(function() {
        var fullMessage = this.buildMessage('', '<?>\ngiven as the method name argument to #assertRespondTo must be a String', method);
        
        this.assertBlock(fullMessage, function() { return typeof method === 'string' });
        
        var type = object ? object.constructor : typeof object;
        fullMessage = this.buildMessage(message, '<?>\n' +
                                                 'of type <?>\n' +
                                                 'expected to respond to <?>',
                                                 object,
                                                 type,
                                                 method);
        this.assertBlock(fullMessage, function() { return object && object[method] !== undefined });
      });
    },
    
    assertMatch: function(pattern, string, message) {
      this.__wrapAssertion__(function() {
        var fullMessage = this.buildMessage(message, '<?> expected to match\n<?>', string, pattern);
        this.assertBlock(fullMessage, function() {
          return JS.match(pattern, string);
        });
      });
    },
    
    assertNoMatch: function(pattern, string, message) {
      this.__wrapAssertion__(function() {
        var fullMessage = this.buildMessage(message, '<?> expected not to match\n<?>', string, pattern);
        this.assertBlock(fullMessage, function() {
          return (typeof pattern.test === 'function')
               ? !pattern.test(string)
               : !pattern.match(string);
        });
      });
    },
    
    assertSame: function(expected, actual, message) {
      var fullMessage = this.buildMessage(message, '<?> expected to be the same as\n' +
                                                   '<?>',
                                                   expected, actual);
      this.assertBlock(fullMessage, function() { return actual === expected });
    },
    
    assertNotSame: function(expected, actual, message) {
      var fullMessage = this.buildMessage(message, '<?> expected not to be the same as\n' +
                                                   '<?>',
                                                   expected, actual);
      this.assertBlock(fullMessage, function() { return actual !== expected });
    },
    
    assertInDelta: function(expected, actual, delta, message) {
      this.__wrapAssertion__(function() {
        this.assertKindOf('number', expected);
        this.assertKindOf('number', actual);
        this.assertKindOf('number', delta);
        this.assert(delta >= 0, 'The delta should not be negative');
        
        var fullMessage = this.buildMessage(message, '<?> and\n' +
                                                     '<?> expected to be within\n' +
                                                     '<?> of each other',
                                                     expected,
                                                     actual,
                                                     delta);
        this.assertBlock(fullMessage, function() {
          return Math.abs(expected - actual) <= delta;
        });
      });
    },
    
    assertSend: function(sendArray, message) {
      this.__wrapAssertion__(function() {
        this.assertKindOf(Array, sendArray, 'assertSend requires an array of send information');
        this.assert(sendArray.length >= 2, 'assertSend requires at least a receiver and a message name');
        var fullMessage = this.buildMessage(message, '<?> expected to respond to\n' +
                                                     '<?(?)> with a true value',
                                                     sendArray[0],
                                                     JS.Test.Unit.AssertionMessage.literal(sendArray[1]),
                                                     sendArray.slice(2));
        this.assertBlock(fullMessage, function() {
          return sendArray[0][sendArray[1]].apply(sendArray[0], sendArray.slice(2));
        });
      });
    },
    
    __processExceptionArgs__: function(args) {
      var args     = JS.array(args),
          context  = (typeof args[args.length - 1] === 'function') ? null : args.pop(),
          block    = args.pop(),
          message  = JS.isType(args[args.length - 1], 'string') ? args.pop() : '',
          expected = new JS.Enumerable.Collection(args);
      
      return [args, expected, message, block, context];
    },
    
    assertThrow: function() {
      var A        = this.__processExceptionArgs__(arguments),
          args     = A[0],
          expected = A[1],
          message  = A[2],
          block    = A[3],
          context  = A[4];
      
      this.__wrapAssertion__(function() {
        var fullMessage = this.buildMessage(message, '<?> exception expected but none was thrown', args),
            actualException;
        
        this.assertBlock(fullMessage, function() {
          try {
            block.call(context);
          } catch (e) {
            actualException = e;
            return true;
          }
          return false;
        });
        
        fullMessage = this.buildMessage(message, '<?> exception expected but was\n?', args, actualException);
        this.assertBlock(fullMessage, function() {
          return expected.any(function(type) {
            return JS.isType(actualException, type) || (actualException.name &&
                                                        actualException.name === type.name);
          });
        });
      });
    },
    
    assertThrows: function() {
      return this.assertThrow.apply(this, arguments);
    },
    
    assertNothingThrown: function() {
      var A        = this.__processExceptionArgs__(arguments),
          args     = A[0],
          expected = A[1],
          message  = A[2],
          block    = A[3],
          context  = A[4];
      
      this.__wrapAssertion__(function() {
        try {
          block.call(context);
        } catch (e) {
          if ((args.length === 0 && !JS.isType(e, JS.Test.Unit.AssertionFailedError)) ||
              expected.any(function(type) { return JS.isType(e, type) }))
            this.assertBlock(this.buildMessage(message, 'Exception thrown:\n?', e), function() { return false });
          else
            throw e;
        }
      });
    },
    
    buildMessage: function() {
      var args     = JS.array(arguments),
          head     = args.shift(),
          template = args.shift();
      return new JS.Test.Unit.AssertionMessage(head, template, args);
    },
    
    __wrapAssertion__: function(block) {
      if (this.__assertionWrapped__ === undefined) this.__assertionWrapped__ = false;
      if (!this.__assertionWrapped__) {
        this.__assertionWrapped__ = true;
        try {
          this.addAssertion();
          return block.call(this);
        } finally {
          this.__assertionWrapped__ = false;
        }
      } else {
        return block.call(this);
      }
    },
    
    addAssertion: function() {}
  })
});


JS.Test.Unit.extend({
  AssertionMessage: new JS.Class({
    extend: {
      Literal: new JS.Class({
        initialize: function(value) {
          this._value = value;
          this.toString = this.inspect;
        },
        
        inspect: function() {
          return this._value.toString();
        }
      }),
      
      literal: function(value) {
        return new this.Literal(value);
      },
      
      Template: new JS.Class({
        extend: {
          create: function(string) {
            var parts = string ? string.match(/\(\?\)|(?=[^\\])\?|(?:(?!\(\?\))(?:\\\?|[^\?]))+/g) : [];
            return new this(parts);
          }
        },
        
        initialize: function(parts) {
          this._parts = new JS.Enumerable.Collection(parts);
          this.count = this._parts.findAll(function(e) { return e === '?' || e === '(?)' }).length;
        },
        
        result: function(parameters) {
          if (parameters.length !== this.count) throw 'The number of parameters does not match the number of substitutions';
          var params = JS.array(parameters);
          return this._parts.collect(function(e) {
            if (e === '(?)') return params.shift().replace(/^\[/, '(').replace(/\]$/, ')');
            if (e === '?') return params.shift();
            return e.replace(/\\\?/g, '?');
          }).join('');
        }
      })
    },
    
    initialize: function(head, template, parameters) {
      this._head = head;
      this._templateString = template;
      this._parameters = new JS.Enumerable.Collection(parameters);
    },
    
    template: function() {
      return this._template = this._template || this.klass.Template.create(this._templateString);
    },
    
    toString: function() {
      var messageParts = [], head, tail;
      if (this._head) messageParts.push(this._head);
      tail = this.template().result(this._parameters.collect(function(e) {
        return JS.Console.convert(e);
      }, this));
      if (tail !== '') messageParts.push(tail);
      return messageParts.join('\n');
    }
  })
});


JS.Test.Unit.extend({
  Failure: new JS.Class({
    initialize: function(testCase, message) {
      this._testCase = testCase;
      this._message  = message;
    },
    
    metadata: function() {
      return {
        test:   this.testMetadata(),
        error:  this.errorMetadata()
      }
    },
    
    testMetadata: function() {
      return this._testCase.metadata();
    },
    
    errorMetadata: function() {
      return {
        type:     'failure',
        message:  this._message
      };
    }
  })
});


JS.Test.Unit.extend({
  Error: new JS.Class({
    initialize: function(testCase, exception) {
      this._testCase  = testCase;
      this._exception = exception;
    },
    
    metadata: function() {
      return {
        test:   this.testMetadata(),
        error:  this.errorMetadata()
      }
    },
    
    testMetadata: function() {
      return this._testCase.metadata();
    },
    
    errorMetadata: function() {
      return {
        type:       'error',
        message:    this._exception.name + ': ' + this._exception.message,
        backtrace:  JS.Console.filterBacktrace(this._exception.stack)
      };
    }
  })
});


JS.Test.Unit.extend({
  TestResult: new JS.Class({
    include: JS.Test.Unit.Observable,
    
    extend: {
      CHANGED:  'Test.Unit.TestResult.CHANGED',
      FAULT:    'Test.Unit.TestResult.FAULT'
    },
    
    initialize: function() {
      this._runCount = this._assertionCount = 0;
      this._failures = [];
      this._errors   = [];
    },
    
    addRun: function() {
      this._runCount += 1;
      this.notifyListeners(this.klass.CHANGED, this);
    },
    
    addFailure: function(failure) {
      this._failures.push(failure);
      this.notifyListeners(this.klass.FAULT, failure);
      this.notifyListeners(this.klass.CHANGED, this);
    },
    
    addError: function(error) {
      this._errors.push(error);
      this.notifyListeners(this.klass.FAULT, error);
      this.notifyListeners(this.klass.CHANGED, this);
    },
    
    addAssertion: function() {
      this._assertionCount += 1;
      this.notifyListeners(this.klass.CHANGED, this);
    },
    
    passed: function() {
      return this._failures.length === 0 && this._errors.length === 0;
    },
    
    runCount: function() {
      return this._runCount;
    },
    
    assertionCount: function() {
      return this._assertionCount;
    },
    
    failureCount: function() {
      return this._failures.length;
    },
    
    errorCount: function() {
      return this._errors.length;
    },
    
    metadata: function() {
      return {
        passed:     this.passed(),
        tests:      this.runCount(),
        assertions: this.assertionCount(),
        failures:   this.failureCount(),
        errors:     this.errorCount()
      };
    }
  })
});


JS.Test.Unit.extend({
  TestSuite: new JS.Class({
    include: JS.Enumerable,
    
    extend: {
      STARTED:  'Test.Unit.TestSuite.STARTED',
      FINISHED: 'Test.Unit.TestSuite.FINISHED',
      
      forEach: function(tests, block, continuation, context) {
        var looping    = false,
            pinged     = false,
            n          = tests.length,
            i          = -1,
            breakTime  = new Date().getTime(),
            setTimeout = this.setTimeout;
        
        var ping = function() {
          pinged = true;
          var time = new Date().getTime();
          
          if (JS.Console.BROWSER && (time - breakTime) > 1000) {
            breakTime = time;
            looping = false;
            setTimeout(iterate, 0);
          }
          else if (!looping) {
            looping = true;
            while (looping) iterate();
          }
        };
        
        var iterate = function() {
          i += 1;
          if (i === n) {
            looping = false;
            return continuation && continuation.call(context || null);
          }
          pinged = false;
          block.call(context || null, tests[i], ping);
          if (!pinged) looping = false;
        };
        
        ping();
      },
      
      // Fun fact: in IE, typeof setTimeout === 'object'
      setTimeout: (function() {
        return (typeof setTimeout === 'undefined')
               ? undefined
               : setTimeout;
      })()
    },
    
    initialize: function(name) {
      this._name = name || 'Unnamed TestSuite';
      this._tests = [];
    },
    
    forEach: function(block, continuation, context) {
      this.klass.forEach(this._tests, block, continuation, context);
    },
    
    run: function(result, continuation, callback, context) {
      callback.call(context || null, this.klass.STARTED, this);
      
      this.forEach(function(test, resume) {
        test.run(result, resume, callback, context)
        
      }, function() {
        callback.call(context || null, this.klass.FINISHED, this);
        continuation.call(context || null);
        
      }, this);
    },
    
    push: function(test) {
      this._tests.push(test);
      return this;
    },
    
    remove: function(test) {
      var i = this._tests.length;
      while (i--) {
        if (this._tests[i] === test) this._tests.splice(i,1);
      }
    },
    
    size: function() {
      var totalSize = 0, i = this._tests.length;
      while (i--) {
        totalSize += this._tests[i].size();
      }
      return totalSize;
    },
    
    empty: function() {
      return this._tests.length === 0;
    },
    
    toString: function() {
      return this._name;
    }
  })
});


JS.Test.Unit.extend({
  TestCase: new JS.Class({
    include: JS.Test.Unit.Assertions,
    
    extend: [JS.Enumerable, {
      STARTED:  'Test.Unit.TestCase.STARTED',
      FINISHED: 'Test.Unit.TestCase.FINISHED',
      
      testCases: [],
      reports:   [],
      handlers:  [],
      
      clear: function() {
        this.testCases = [];
      },
      
      inherited: function(klass) {
        this.testCases.push(klass);
      },
      
      forEach: function(block, context) {
        for (var i = 0, n = this.testCases.length; i < n; i++)
          block.call(context || null, this.testCases[i]);
      },
      
      metadata: function() {
        var shortName = this._contextName || this.displayName,
            context   = [],
            klass     = this.superclass;
        
        while (klass !== JS.Test.Unit.TestCase) {
          context.unshift(klass._contextName || klass.displayName); // TODO actually model this properly in Context
          klass = klass.superclass;
        }
        return {
          fullName:   context.concat(shortName).join(' '),
          shortName:  shortName,
          context:    context
        };
      },
      
      suite: function(filter, inherit, useDefault) {
        var fullName    = this.metadata().fullName,
            methodNames = new JS.Enumerable.Collection(this.instanceMethods(inherit)),
            
            tests = methodNames.select(function(name) {
              return /^test./.test(name) && this.filter(fullName + ' ' + name, filter);
            }, this).sort(),
            
            suite = new JS.Test.Unit.TestSuite(this.displayName);
        
        for (var i = 0, n = tests.length; i < n; i++) {
          try { suite.push(new this(tests[i])) } catch (e) {}
        }
        if (suite.empty() && useDefault) {
          try { suite.push(new this('defaultTest')) } catch (e) {}
        }
        return suite;
      },
      
      filter: function(name, filter) {
        if (!filter || filter.length === 0) return true;
        return name.indexOf(filter) >= 0;
      }
    }],
    
    initialize: function(testMethodName) {
      if (typeof this[testMethodName] !== 'function') throw 'invalid_test';
      this._methodName = testMethodName;
      this._testPassed = true;
    },
    
    run: function(result, continuation, callback, context) {
      callback.call(context || null, this.klass.STARTED, this);
      this._result = result;
      
      var teardown = function() {
        this.exec('teardown', function() {
          this.exec(function() { JS.Test.Unit.mocking.verify() }, function() {
            result.addRun();
            callback.call(context || null, this.klass.FINISHED, this);
            continuation();
          });
        });
      };
      
      this.exec('setup', function() {
        this.exec(this._methodName, teardown);
      }, teardown);
    },
    
    exec: function(methodName, onSuccess, onError) {
      if (!methodName) return onSuccess.call(this);
      
      if (!onError) onError = onSuccess;
      
      var arity = (typeof methodName === 'function')
                ? methodName.length
                : this.__eigen__().instanceMethod(methodName).arity,
          
          callable = (typeof methodName === 'function') ? methodName : this[methodName],
          timeout  = null,
          failed   = false,
          resumed  = false,
          self     = this;
      
      if (arity === 0)
        return this._runWithExceptionHandlers(function() {
          callable.call(this);
          onSuccess.call(this);
        }, this._processError(onError));
      
      var onUncaughtError = function(error) {
        self.exec(function() {
          failed = true;
          this._removeErrorCatcher();
          if (timeout) JS.ENV.clearTimeout(timeout);
          throw error;
        }, onSuccess, onError);
      };
      this._addErrorCatcher(onUncaughtError);
      
      this._runWithExceptionHandlers(function() {
        callable.call(this, function(asyncBlock) {
          resumed = true;
          self._removeErrorCatcher();
          if (timeout) JS.ENV.clearTimeout(timeout);
          if (!failed) self.exec(asyncBlock, onSuccess, onError);
        });
      }, this._processError(onError));
      
      if (!resumed && JS.ENV.setTimeout)
        timeout = JS.ENV.setTimeout(function() {
          self.exec(function() {
            failed = true;
            this._removeErrorCatcher();
            throw new Error('Timed out after waiting ' + JS.Test.asyncTimeout + ' seconds for test to resume');
          }, onSuccess, onError);
        }, JS.Test.asyncTimeout * 1000);
    },
    
    _addErrorCatcher: function(handler, push) {
      if (!handler) return;
      this._removeErrorCatcher(false);
      
      if (JS.Console.NODE)
        process.addListener('uncaughtException', handler);
      else if (JS.Console.BROWSER)
        window.onerror = handler;
      
      if (push !== false) this.klass.handlers.push(handler);
      return handler;
    },
    
    _removeErrorCatcher: function(pop) {
      var handlers = this.klass.handlers,
          handler  = handlers[handlers.length - 1];
      
      if (!handler) return;
      
      if (JS.Console.NODE)
        process.removeListener('uncaughtException', handler);
      else if (JS.Console.BROWSER)
        window.onerror = null;
      
      if (pop !== false) {
        handlers.pop();
        this._addErrorCatcher(handlers[handlers.length - 1], false);
      }
    },
    
    _processError: function(doNext) {
      return function(e) {
        if (JS.isType(e, JS.Test.Unit.AssertionFailedError))
          this.addFailure(e.message);
        else
          this.addError(e);
        
        if (doNext) doNext.call(this);
      };
    },
    
    _runWithExceptionHandlers: function(_try, _catch, _finally) {
      try {
        _try.call(this);
      } catch (e) {
        if (_catch) _catch.call(this, e);
      } finally {
        if (_finally) _finally.call(this);
      }
    },
    
    setup: function(resume) { resume() },
    
    teardown: function(resume) { resume() },
    
    defaultTest: function() {
      return this.flunk('No tests were specified');
    },
    
    passed: function() {
      return this._testPassed;
    },
    
    size: function() {
      return 1;
    },
    
    addAssertion: function() {
      this._result.addAssertion();
    },
    
    addFailure: function(message) {
      this._testPassed = false;
      this._result.addFailure(new JS.Test.Unit.Failure(this, message));
    },
    
    addError: function(exception) {
      this._testPassed = false;
      this._result.addError(new JS.Test.Unit.Error(this, exception));
    },
    
    name: function() {
      var shortName = this._methodName.replace(/^test\W*/ig, '');
      if (shortName.replace(this.klass.displayName, '') === shortName)
        return this._methodName + '(' + this.klass.displayName + ')';
      else
        return shortName;
    },
    
    metadata: function() {
      var shortName = this._methodName.replace(/^test:\W*/ig, ''),
          context   = [],
          klass     = this.klass;
      
      while (klass !== JS.Test.Unit.TestCase) {
        context.unshift(klass._contextName || klass.displayName); // TODO actually model this properly in Context
        klass = klass.superclass;
      }
      return {
        fullName:   context.concat(shortName).join(' '),
        shortName:  shortName,
        context:    context
      };
    },
    
    toString: function() {
      return this.name();
    }
  })
});


JS.Test.UI.extend({
  Terminal: new JS.Class({
    OPTIONS: {format: String, test: String},
    SHORTS:  {'f': '--format', 't': '--test'},
    
    prepare: function(callback, context) {
      callback.call(context || null, this);
    },
    
    getOptions: function() {
      var options = {};
      
      if (JS.Console.NODE) {
        options = require('nopt')(this.OPTIONS, this.SHORTS);
        if (process.env.TAP) options.format = 'tap';
        delete options.argv;
      }
      return options;
    },
    
    getReporters: function(options) {
      var reporters = [],
          R = JS.Test.Reporters;
      
      var Printer = R.find(options.format) || R.Progress;
      reporters.push(new Printer(options));
      reporters.push(new R.ExitStatus(options));
      
      return reporters;
    }
  })
});


JS.Test.UI.extend({
  Browser: new JS.Class({
    prepare: function(callback, context) {
      var hash = (window.location.hash || '').replace(/^#/, ''),
          self = this;
      
      if (hash === 'testem') {
        JS.Package.Loader.loadFile('/testem.js', function() {
          callback.call(context || null, self);
        });
      } else {
        callback.call(context || null, self);
      }
    },
    
    getOptions: function() {
      var qs      = (window.location.search || '').replace(/^\?/, ''),
          pairs   = qs.split('&'),
          options = {},
          parts;
      
      for (var i = 0, n = pairs.length; i < n; i++) {
        parts = pairs[i].split('=');
        options[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
      }
      return options;
    },
    
    getReporters: function(options) {
      var reporters = [],
          R         = JS.Test.Reporters,
          browser   = new R.Browser(options);
      
      reporters.push(browser);
      
      if (JS.ENV.TestSwarm)
        reporters.push(new R.TestSwarm(options, browser));
      else if (JS.ENV.Testem)
        reporters.push(new R.Testem(options));
      else
        reporters.push(new R.Console(options));
      
      return reporters;
    }
  })
});


JS.Test.Reporters.extend({
  Progress: new JS.Class({
    include: JS.Console,
    
    SYMBOLS: {
      failure:  'F',
      error:    'E'
    },
    
    NAMES: {
      failure:  'Failure',
      error:    'Error'
    },
    
    initialize: function() {
      this._faults = [];
    },
    
    startRun: function(event) {
      this.consoleFormat('bold');
      this.puts('Loaded suite: ' + event.suites.join(', '));
      this.puts('');
      this.reset();
      this.puts('Started');
    },
    
    startSuite: function(event) {},
    
    startTest: function(event) {
      this._outputFault = false;
    },
    
    addFault: function(event) {
      this._faults.push(event);
      if (this._outputFault) return;
      this._outputFault = true;
      this.consoleFormat('bold','red');
      this.print(this.SYMBOLS[event.error.type]);
      this.reset();
    },
    
    endTest: function(event) {
      if (this._outputFault) return;
      this.consoleFormat('green');
      this.print('.');
      this.reset();
    },
    
    endSuite: function(event) {},
    
    update: function(event) {},
    
    endRun: function(event) {
      for (var i = 0, n = this._faults.length; i < n; i++)
        this._printFault(i + 1, this._faults[i]);
      
      this.reset();
      this.puts('');
      this.puts('Finished in ' + event.runtime + ' seconds');
      
      this._printSummary(event);
    },
    
    _printFault: function(index, fault) {
        this.puts('');
        this.consoleFormat('bold', 'red');
        this.puts('\n' + index + ') ' + this.NAMES[fault.error.type] + ': ' + fault.test.fullName);
        this.reset();
        this.puts(fault.error.message);
        if (fault.error.backtrace) this.puts(fault.error.backtrace);
        this.reset();
    },
    
    _printSummary: function(event) {
      var color = event.passed ? 'green' : 'red';
      this.consoleFormat(color);
      this.puts(this._plural(event.tests, 'test') + ', ' +
                this._plural(event.assertions, 'assertion') + ', ' +
                this._plural(event.failures, 'failure') + ', ' +
                this._plural(event.errors, 'error'));
      this.reset();
      this.puts('');
    },
    
    _plural: function(number, noun) {
      return number + ' ' + noun + (number === 1 ? '' : 's');
    }
  })
});

JS.Test.Reporters.register('progress', JS.Test.Reporters.Progress);


JS.Test.Reporters.extend({
  TAP: new JS.Class({
    include: JS.Console,
    
    startRun: function(event) {
      this._testId = 0;
    },
    
    startSuite: function(event) {},
    
    startTest: function(event) {
      this._testPassed = true;
      this._faults = [];
    },
    
    addFault: function(event) {
      this._testPassed = false;
      this._faults.push(event);
    },
    
    endTest: function(event) {
      var line = this._testPassed ? 'ok' : 'not ok';
      line += ' ' + ++this._testId + ' ' + event.fullName;
      this.puts(line);
      
      var fault, message, parts, j, m;
      for (var i = 0, n = this._faults.length; i < n; i++) {
        fault = this._faults[i];
        var message = fault.error.message;
        if (fault.error.backtrace) message += '\n' + fault.error.backtrace;
        parts = message.split(/[\r\n]/);
        for (j = 0, m = parts.length; j < m; j++)
          this.puts('    ' + parts[j]);
      }
    },
    
    endSuite: function(event) {},
    
    update: function(event) {},
    
    endRun: function(event) {}
  })
});

JS.Test.Reporters.register('tap', JS.Test.Reporters.TAP);


JS.Test.Reporters.extend({
  ExitStatus: new JS.Class({
    startRun: function(event) {},
    
    startSuite: function(event) {},
    
    startTest: function(event) {},
    
    addFault: function(event) {},
    
    endTest: function(event) {},
    
    endSuite: function(event) {},
    
    update: function(event) {},
    
    endRun: function(event) {
      JS.Console.exit(event.passed ? 0 : 1);
    }
  })
});


JS.Test.Reporters.extend({
  Browser: new JS.Class({
    initialize: function() {
      var self = this;
      
      this._container = JS.DOM.div({className: 'test-result-container'}, function(div) {
        div.table({className: 'report'}, function(table) {
          table.thead(function(thead) {
            thead.tr(function(tr) {
              tr.th({scope: 'col'}, 'Tests');
              tr.th({scope: 'col'}, 'Assertions');
              tr.th({scope: 'col'}, 'Failures');
              tr.th({scope: 'col'}, 'Errors');
            });
          });
          table.tbody(function(tbody) {
            tbody.tr(function(tr) {
              self._tests      = tr.td();
              self._assertions = tr.td();
              self._failures   = tr.td();
              self._errors     = tr.td();
            });
          });
        });
        self._light = div.div({className: 'light light-pending'});
        div.p({className: 'user-agent'}, window.navigator.userAgent);
        self._context = new self.klass.Context('spec', div.ul({className: 'specs'}));
        self._summary = div.p({className: 'summary'});
      });
      
      document.body.insertBefore(this._container, document.body.firstChild);
    },
    
    _contextFor: function(test) {
      var context = this._context,
          scopes  = test.context;
      
      for (var i = 0, n = scopes.length; i < n; i++)
        context = context.child(scopes[i]);
      
      return context;
    },
    
    startRun: function(event) {
      this.update({tests: 0, assertions: 0, failures: 0, errors: 0});
    },
    
    startSuite: function(event) {},
    
    startTest: function(event) {
      this._contextFor(event).addTest(event.shortName);
    },
    
    addFault: function(event) {
      this._contextFor(event.test).child(event.test.shortName).addFault(event.error);
    },
    
    endTest: function(event) {},
    
    endSuite: function(event) {},
    
    update: function(event) {
      this._tests.innerHTML      = String(event.tests);
      this._assertions.innerHTML = String(event.assertions);
      this._failures.innerHTML   = String(event.failures);
      this._errors.innerHTML     = String(event.errors);
    },
    
    endRun: function(event) {
      this.update(event);
      JS.DOM.removeClass(this._light, 'light-pending');
      JS.DOM.addClass(this._light, event.passed ? 'light-passed' : 'light-failed');
      this._summary.innerHTML = 'Finished in ' + event.runtime + ' seconds';
    },
    
    serialize: function() {
      var items = document.getElementsByTagName('li'),
          n     = items.length;
      while (n--) JS.DOM.removeClass(items[n], 'closed');
      
      var items = document.getElementsByTagName('script'),
          n     = items.length;
      while (n--) items[n].parentNode.removeChild(items[n]);
      
      var html = document.getElementsByTagName('html')[0];
      return '<!doctype html><html>' + html.innerHTML + '</html>';
    }
  })
});

JS.Test.Reporters.Browser.extend({
  Context: new JS.Class({
    initialize: function(type, parent, name) {
      this._parent   = parent;
      this._type     = type;
      this._name     = name;
      this._children = [];
      
      if (name === undefined) {
        this._ul = parent;
        return;
      }
      
      var container = this._parent._ul || this._parent,
          fields    = {_tests: 'Tests', _failures: 'Failed'},
          self      = this;
      
      this._li = new JS.DOM.Builder(container).li({className: this._type + ' passed'}, function(li) {
        li.ul({className: 'stats'}, function(ul) {
          for (var key in fields)
            ul.li(function(li) {
              li.span({className: 'label'}, fields[key] + ': ');
              self[key] = li.span({className: 'number'}, '0');
            });
        });
        if (name) {
          self._toggle = li.p({className: self._type + '-name'}, name);
          if (self._type === 'spec') {
            self._runner = JS.DOM.span({className: 'runner'}, 'Run');
            self._runner.style.background = 'url("' + JSCLASS_PATH + 'assets/bullet_go.png") center center no-repeat';
            self._toggle.insertBefore(self._runner, self._toggle.firstChild);
          }
        }
        self._ul = li.ul({className: 'children'});
      });
      
      var pattern = /\btest=/; // TODO get this from a UI abstraction
      if (!pattern.test(window.location.search))
        JS.DOM.addClass(this._li, 'closed');
      
      JS.DOM.Event.on(this._toggle, 'click', function() {
        JS.DOM.toggleClass(this._li, 'closed');
      }, this);
      
      if (this._runner)
        JS.DOM.Event.on(this._runner, 'click', this.runTest, this);
    },
    
    ping: function(field) {
      if (!this[field]) return;
      this[field].innerHTML = parseInt(this[field].innerHTML) + 1;
      if (this._parent.ping) this._parent.ping(field);
    },
    
    fail: function() {
      if (!this._li) return;
      JS.DOM.removeClass(this._li, 'passed');
      JS.DOM.addClass(this._toggle, 'failed');
      if (this._parent.fail) this._parent.fail();
    },
    
    child: function(name) {
      return this._children[name] = this._children[name] ||
                                    new this.klass('spec', this, name);
    },
    
    addTest: function(name) {
      var test = this._children[name] = new this.klass('test', this, name);
      test.ping('_tests');
    },
    
    addFault: function(fault) {
      var message = fault.message;
      if (fault.backtrace) message += '\n' + fault.backtrace;
      
      var item = JS.DOM.li({className: 'fault'}, function(li) {
        li.p(function(p) {
          var parts = message.split(/[\r\n]+/);
          for (var i = 0, n = parts.length; i < n; i++) {
            if (i > 0) p.br();
            p.concat(parts[i]);
          }
        });
      });
      this._ul.appendChild(item);
      this.ping('_failures');
      this.fail();
    },
    
    getName: function() {
      var parts  = [],
          parent = this._parent && this._parent.getName && this._parent.getName();
      
      if (parent) parts.push(parent);
      parts.push(this._name);
      return parts.join(' ');
    },
    
    runTest: function() {
      window.location.search = 'test=' + encodeURIComponent(this.getName());
    }
  })
});


JS.Test.Reporters.extend({
  Console: new JS.Class({
    _log: function(eventName, data) {
      if (!window.console || !window.console.log || !window.JSON) return;
      console.log(JSON.stringify({jstest: [eventName, data]}));
    }
  })
});


(function() {
  var methods = JS.Test.Reporters.METHODS,
      n       = methods.length;
  
  while (n--)
    (function(i) {
      var method = methods[i];
      JS.Test.Reporters.Console.define(method, function(event) {
        this._log(method, event);
      });
    })(n);
})();


JS.Test.Reporters.extend({
  Testem: new JS.Class({
    initialize: function() {
      var self = this;
      Testem.useCustomAdapter(function(socket) { self._socket = socket });
    },
    
    startRun: function(event) {
      this._results = [];
      this._testId = 0;
      this._socket.emit('tests-start');
    },
    
    startSuite: function(event) {},
    
    startTest: function(event) {
      this._testPassed = true;
      this._faults = [];
    },
    
    addFault: function(event) {
      this._testPassed = false;
      this._faults.push({
        passed:     false,
        message:    event.error.message,
        stacktrace: event.error.backtrace
      });
    },
    
    endTest: function(event) {
      var result = {
        passed: this._testPassed ? 1 : 0,
        failed: this._testPassed ? 0 : 1,
        total:  1,
        id:     ++this._testId,
        name:   event.fullName,
        items:  this._faults
      };
      this._results.push(result);
      this._socket.emit('test-result', result);
    },
    
    endSuite: function(event) {},
    
    update: function(event) {},
    
    endRun: function(event) {
      this._socket.emit('all-test-results', {
        passed: event.tests - event.failures - event.errors,
        failed: event.failures,
        total:  event.tests,
        tests:  this._results
      });
    }
  })
});


JS.Test.Reporters.extend({
  TestSwarm: new JS.Class({
    initialize: function(options, browserReporter) {
      this._browserReporter = browserReporter;
      
      TestSwarm.serialize = function() {
        return browserReporter.serialize();
      };
    },
    
    startRun: function(event) {},
    
    startSuite: function(event) {},
    
    startTest: function(event) {},
    
    addFault: function(event) {},
    
    endTest: function(event) {
      TestSwarm.heartbeat();
    },
    
    endSuite: function(event) {},
    
    update: function(event) {},
    
    endRun: function(event) {
      TestSwarm.submit({
        fail:   event.failures,
        error:  event.errors,
        total:  event.tests
      });
    }
  })
});


JS.Test.Reporters.extend({
  Composite: new JS.Class({
    initialize: function(reporters) {
      this._reporters = reporters || [];
    },
    
    addReporter: function(reporter) {
      this._reporters.push(reporter);
    },
    
    removeReporter: function(reporter) {
      var index = JS.indexOf(this._reporters, reporter);
      if (index >= 0) this._reporters.splice(index, 1);
    }
  })
});

(function() {
  var methods = JS.Test.Reporters.METHODS,
      n       = methods.length;
  
  while (n--)
    (function(i) {
      var method = methods[i];
      JS.Test.Reporters.Composite.define(method, function(event) {
        var fn;
        for (var i = 0, n = this._reporters.length; i < n; i++) {
          fn = this._reporters[i][method];
          if (fn) fn.call(this._reporters[i], event);
        }
      });
    })(n);
})();


JS.Test.extend({
  Context: new JS.Module({
    extend: {
      included: function(base) {
        base.extend(JS.Test.Context.Context, {_resolve: false});
        base.include(JS.Test.Context.LifeCycle, {_resolve: false});
        base.extend(JS.Test.Context.Test, {_resolve: false});
        base.include(JS.Console);
      },
      
      Context: new JS.Module({
        getContextName: function() {
          this._contextName = this._contextName || '';
          return (typeof this.superclass.getContextName === 'function')
            ? (this.superclass.getContextName() + ' ' + this._contextName).replace(/^\s+/, '')
            : this.displayName;
        },
        
        setContextName: function(name) {
          this._contextName = name;
        },
        
        context: function(name, block) {
          var klass = new JS.Class(this, {}, {_resolve: false});
          klass.__eigen__().resolve();
          
          klass.setContextName(name.toString());
          klass.setName(klass.getContextName());
          
          block.call(klass);
          return klass;
        },
        
        cover: function(module) {
          var logger = new JS.Test.Coverage(module);
          this.before_all_callbacks.push(logger.method('attach'));
          this.after_all_callbacks.push(logger.method('detach'));
          JS.Test.Unit.TestCase.reports.push(logger);
        }
      })
    }
  }),
  
  describe: function(name, block) {
    var klass = new JS.Class(name.toString(), JS.Test.Unit.TestCase, {}, {_resolve: false});
    klass.include(JS.Test.Context, {_resolve: false});
    klass.__eigen__().resolve();
    
    block.call(klass);
    return klass;
  }
});

JS.Test.Context.Context.alias({describe: 'context'});

JS.Test.extend({
  context:  JS.Test.describe
});


JS.Test.Context.LifeCycle = new JS.Module({
  extend: {
    included: function(base) {
      base.extend(this.ClassMethods);
      
      base.before_all_callbacks     = [];
      base.before_each_callbacks    = [];
      base.after_all_callbacks      = [];
      base.after_each_callbacks     = [];
      base.before_should_callbacks  = {};
      
      base.extend({
        inherited: function(child) {
          this.callSuper();
          child.before_all_callbacks    = [];
          child.before_each_callbacks   = [];
          child.after_all_callbacks     = [];
          child.after_each_callbacks    = [];
          child.before_should_callbacks = {};
        }
      });
    },
    
    ClassMethods: new JS.Module({
      before: function(period, block) {
        if ((typeof period === 'function') || !block) {
          block  = period;
          period = 'each';
        }
        
        this['before_' + (period + '_') + 'callbacks'].push(block);
      },
      
      after: function(period, block) {
        if ((typeof period === 'function') || !block) {
          block  = period;
          period = 'each';
        }
        
        this['after_' + (period + '_') + 'callbacks'].push(block);
      },
      
      gatherCallbacks: function(callbackType, period) {
        var outerCallbacks = (typeof this.superclass.gatherCallbacks === 'function')
          ? this.superclass.gatherCallbacks(callbackType, period)
          : [];
        
        var mine = this[callbackType + '_' + (period + '_') + 'callbacks'];
        
        return (callbackType === 'before')
                ? outerCallbacks.concat(mine)
                : mine.concat(outerCallbacks);
      }
    })
  },
  
  setup: function(resume) {
    var self = this;
    this.callSuper(function() {
      if (self.klass.before_should_callbacks[self._methodName])
        self.klass.before_should_callbacks[self._methodName].call(self);
      
      self.runCallbacks('before', 'each', resume);
    });
  },
  
  teardown: function(resume) {
    var self = this;
    this.callSuper(function() {
      self.runCallbacks('after', 'each', resume);
    });
  },
  
  runCallbacks: function(callbackType, period, continuation) {
    var callbacks = this.klass.gatherCallbacks(callbackType, period);
    
    JS.Test.Unit.TestSuite.forEach(callbacks, function(callback, resume) {
      this.exec(callback, resume);
      
    }, continuation, this);
  },
  
  runAllCallbacks: function(callbackType, continuation, context) {
    var previousIvars = this.instanceVariables();
    this.runCallbacks(callbackType, 'all', function() {
      
      var ivars = this.instanceVariables().inject({}, function(hash, ivar) {
        if (previousIvars.member(ivar)) return hash;
        hash[ivar] = this[ivar];
        return hash;
      }, this);
      
      if (continuation) continuation.call(context || null, ivars);
    });
  },
  
  setValuesFromCallbacks: function(values) {
    for (var key in values)
      this[key] = values[key];
  },
  
  instanceVariables: function() {
    var ivars = [];
    for (var key in this) {
      if (this.hasOwnProperty(key)) ivars.push(key);
    }
    return new JS.Enumerable.Collection(ivars);
  }
});

(function() {
  var m = JS.Test.Context.LifeCycle.ClassMethods.method('instanceMethod');
  
  JS.Test.Context.LifeCycle.ClassMethods.include({
    setup:    m('before'),
    teardown: m('after')
  });
})();


JS.Test.Context.extend({
  SharedBehavior: new JS.Class(JS.Module, {
    extend: {
      createFromBehavior: function(beh) {
        var mod = new this();
        mod._behavior = beh;
        return mod;
      },
      
      moduleName: function(name) {
        return name.toLowerCase()
                   .replace(/[\s:',\.~;!#=\(\)&]+/g, '_')
                   .replace(/\/(.?)/g, function(m,a) { return '.' + a.toUpperCase() })
                   .replace(/(?:^|_)(.)/g, function(m,a) { return a.toUpperCase() });
      }
    },
    
    included: function(arg) {
      this._behavior.call(arg);
    }
  })
});

JS.Test.Unit.TestCase.extend({
  shared: function(name, block) {
    name = JS.Test.Context.SharedBehavior.moduleName(name);
    JS.ENV[name] = JS.Test.Context.SharedBehavior.createFromBehavior(block);
  },
  
  use: function(sharedName) {
    if (JS.isType(sharedName, JS.Test.Context.SharedBehavior) ||
        JS.isType(sharedName, JS.Module))
      this.include(sharedName);
    
    else if (JS.isType(sharedName, 'string')) {
      var name = JS.Test.Context.SharedBehavior.moduleName(sharedName),
          beh  = JS.ENV[name];
      
      if (!beh) throw new Error('Could not find example group named "' + sharedName + '"');
      this.include(beh);
    }
  }
});

(function() {
  var alias = function(method, aliases) {
    var extension = {};
    for (var i = 0, n = aliases.length; i < n; i++)
      extension[aliases[i]] = JS.Test.Unit.TestCase[method];
    JS.Test.Unit.TestCase.extend(extension);
  };
  
  alias('shared', ['sharedBehavior', 'shareAs', 'shareBehaviorAs', 'sharedExamplesFor']);
  alias('use', ['uses', 'itShouldBehaveLike', 'behavesLike', 'usesExamplesFrom']);
})();


JS.Test.Context.Test = new JS.Module({
  test: function(name, opts, block) {
    var testName = 'test: ' + name;
    
    if (JS.indexOf(this.instanceMethods(false), testName) >= 0)
      throw new Error(testName + ' is already defined in ' + this.displayName);
    
    opts = opts || {};
    
    if (typeof opts === 'function') {
      block = opts;
    } else {     
      if (opts.before !== undefined)
        this.before_should_callbacks[testName] = opts.before;
    }
    
    this.define(testName, block, {_resolve: false});
  },
  
  beforeTest: function(name, block) {
    this.test(name, {before: block}, function() {});
  }
});

JS.Test.Context.Test.alias({
  it:     'test',
  should: 'test',
  tests:  'test',
  
  beforeIt:     'beforeTest',
  beforeShould: 'beforeTest',
  beforeTests:  'beforeTest'
});


(function() {
  var suite = JS.Test.Unit.TestCase.suite;
  
  JS.Test.Unit.TestCase.extend({
    // Tweaks to standard method so we don't get superclass methods and we don't
    // get weird default tests
    suite: function(filter) {
      return suite.call(this, filter, false, false);
    }
  });
})();

JS.Test.Unit.TestSuite.include({
  run: function(result, continuation, callback, context) {
    callback.call(context || null, this.klass.STARTED, this._name);
    
    var withIvars = function(ivarsFromCallback) {
      this.forEach(function(test, resume) {
        if (ivarsFromCallback) test.setValuesFromCallbacks(ivarsFromCallback);
        test.run(result, resume, callback, context);
        
      }, function() {
        var afterCallbacks = function() {
          callback.call(context || null, this.klass.FINISHED, this._name);
          continuation();
        };
        if (ivarsFromCallback) first.runAllCallbacks('after', afterCallbacks, this);
        else afterCallbacks.call(this);
        
      }, this);
    };
    
    var first = this._tests[0], ivarsFromCallback = null;
    
    if (first && first.runAllCallbacks)
      first.runAllCallbacks('before', withIvars, this);
    else
      withIvars.call(this, null);
  }
});


JS.Test.extend({
  Mocking: new JS.Module({
    extend: {
      ExpectationError: new JS.Class(JS.Test.Unit.AssertionFailedError),
      
      UnexpectedCallError: new JS.Class(Error, {
        initialize: function(message) {
          this.message = message.toString();
        }
      }),
      
      __activeStubs__: [],
      
      stub: function(object, methodName, implementation) {
        var constructor = false;
        
        if (object === 'new') {
          object         = methodName;
          methodName     = implementation;
          implementation = undefined;
          constructor    = true;
        }
        if (JS.isType(object, 'string')) {
          implementation = methodName;
          methodName     = object;
          object         = JS.ENV;
        }
        
        var stubs = this.__activeStubs__,
            i     = stubs.length;
        
        while (i--) {
          if (stubs[i]._object === object && stubs[i]._methodName === methodName)
            return stubs[i].defaultMatcher(implementation);
        }
        
        var stub = new JS.Test.Mocking.Stub(object, methodName, constructor);
        stubs.push(stub);
        return stub.defaultMatcher(implementation);
      },
      
      removeStubs: function() {
        var stubs = this.__activeStubs__,
            i     = stubs.length;
        
        while (i--) stubs[i].revoke();
        this.__activeStubs__ = [];
      },
      
      verify: function() {
        try {
          var stubs = this.__activeStubs__;
          for (var i = 0, n = stubs.length; i < n; i++)
            stubs[i]._verify();
        } finally {
          this.removeStubs();
        }
      },
      
      Stub: new JS.Class({
        initialize: function(object, methodName, constructor) {
          this._object      = object;
          this._methodName  = methodName;
          this._constructor = constructor;
          this._original    = object[methodName];
          
          this._ownProperty = object.hasOwnProperty
                            ? object.hasOwnProperty(methodName)
                            : (typeof this._original !== 'undefined');
          
          var mocking = JS.Test.Mocking;
          
          this._argMatchers = [];
          this._anyArgs     = new mocking.Parameters([new mocking.AnyArgs()]);
          this._expected    = false;
          
          this.apply();
        },
        
        defaultMatcher: function(implementation) {
          if (implementation !== undefined && typeof implementation !== 'function') {
            this._object[this._methodName] = implementation;
            return this;
          }
          
          this._activateLastMatcher();
          this._currentMatcher = this._anyArgs;
          if (typeof implementation === 'function')
            this._currentMatcher._fake = implementation;
          return this;
        },
        
        apply: function() {
          var object = this._object, methodName = this._methodName;
          if (object[methodName] !== this._original) return;
          
          var self = this;
          this._shim = function() { return self._dispatch(this, arguments) };
          object[methodName] = this._shim;
        },
        
        revoke: function() {
          if (this._ownProperty)
            this._object[this._methodName] = this._original;
          else
            try { delete this._object[this._methodName] }
            catch (e) { this._object[this._methodName] = undefined }
        },
        
        expected: function() {
          this._expected = true;
          this._anyArgs._expected = true;
        },
        
        _activateLastMatcher: function() {
          if (this._currentMatcher) this._currentMatcher._active = true;
        },
        
        _dispatch: function(receiver, args) {
          this._activateLastMatcher();
          var matchers = this._argMatchers.concat(this._anyArgs),
              matcher, result, message;
          
          if (this._constructor && !(receiver instanceof this._shim)) {
            message = new JS.Test.Unit.AssertionMessage('',
                          '<?> expected to be a constructor but called without `new`',
                          [this._original]);
            
            throw new JS.Test.Mocking.UnexpectedCallError(message);
          }
          
          this._anyArgs.ping();
          
          for (var i = 0, n = matchers.length; i < n; i++) {
            matcher = matchers[i];
            result  = matcher.match(args);
            
            if (!result) continue;
            if (matcher !== this._anyArgs) matcher.ping();
            
            if (result.fake)
              return result.fake.apply(receiver, args);
            
            if (result.exception) throw result.exception;
            
            if (result.hasOwnProperty('callback')) {
              if (!result.callback) continue;
              result.callback.apply(result.context, matcher.nextYieldArgs());
            }
            
            if (result) return matcher.nextReturnValue();
          }
          
          if (this._constructor) {
            message = new JS.Test.Unit.AssertionMessage('',
                          '<?> constructed with unexpected arguments:\n(?)',
                          [this._original, JS.array(args)]);
          } else {
            message = new JS.Test.Unit.AssertionMessage('',
                          '<?> received call to ' + this._methodName + '() with unexpected arguments:\n(?)',
                          [receiver, JS.array(args)]);
          }
          
          throw new JS.Test.Mocking.UnexpectedCallError(message);
        },
        
        _verify: function() {
          if (!this._expected) return;
          
          for (var i = 0, n = this._argMatchers.length; i < n; i++)
            this._verifyParameters(this._argMatchers[i]);
          
          this._verifyParameters(this._anyArgs);
        },
        
        _verifyParameters: function(parameters) {
          var object = this._constructor ? this._original : this._object;
          parameters.verify(object, this._methodName, this._constructor);
        }
      })
    }
  })
});


JS.Test.Mocking.extend({
  Parameters: new JS.Class({
    initialize: function(params, expected) {
      this._params    = JS.array(params);
      this._expected  = expected;
      this._active    = false;
      this._callsMade = 0;
    },
    
    toArray: function() {
      var array = this._params.slice();
      if (this._yieldArgs) array.push(new JS.Test.Mocking.InstanceOf(Function));
      return array;
    },
    
    returns: function(returnValues) {
      this._returnIndex = 0;
      this._returnValues = returnValues;
    },
    
    nextReturnValue: function() {
      if (!this._returnValues) return undefined;
      var value = this._returnValues[this._returnIndex];
      this._returnIndex = (this._returnIndex + 1) % this._returnValues.length;
      return value;
    },
    
    yields: function(yieldValues) {
      this._yieldIndex = 0;
      this._yieldArgs = yieldValues;
    },
    
    nextYieldArgs: function() {
      if (!this._yieldArgs) return undefined;
      var value = this._yieldArgs[this._yieldIndex];
      this._yieldIndex = (this._yieldIndex + 1) % this._yieldArgs.length;
      return value;
    },
    
    setMinimum: function(n) {
      this._expected = true;
      this._minimumCalls = n;
    },
    
    setMaximum: function(n) {
      this._expected = true;
      this._maximumCalls = n;
    },
    
    setExpected: function(n) {
      this._expected = true;
      this._expectedCalls = n;
    },
    
    match: function(args) {
      if (!this._active) return false;
      
      var argsCopy = JS.array(args), callback, context;
      
      if (this._yieldArgs) {
        if (typeof argsCopy[argsCopy.length - 2] === 'function') {
          context  = argsCopy.pop();
          callback = argsCopy.pop();
        } else if (typeof argsCopy[argsCopy.length - 1] === 'function') {
          context  = null;
          callback = argsCopy.pop();
        }
      }
      
      if (!JS.Enumerable.areEqual(this._params, argsCopy)) return false;
      
      var result = {};
      
      if (this._exception) { result.exception = this._exception }
      if (this._yieldArgs) { result.callback = callback; result.context = context }
      if (this._fake)      { result.fake = this._fake }
      
      return result;
    },
    
    ping: function() {
      this._callsMade += 1;
    },
    
    verify: function(object, methodName, constructor) {
      if (!this._expected) return;
      
      var okay = true, extraMessage;
      
      if (this._callsMade === 0 && this._maximumCalls === undefined && this._expectedCalls === undefined) {
        okay = false;
      } else if (this._expectedCalls !== undefined && this._callsMade !== this._expectedCalls) {
        extraMessage = this._createMessage('exactly');
        okay = false;
      } else if (this._maximumCalls !== undefined && this._callsMade > this._maximumCalls) {
        extraMessage = this._createMessage('at most');
        okay = false;
      } else if (this._minimumCalls !== undefined && this._callsMade < this._minimumCalls) {
        extraMessage = this._createMessage('at least');
        okay = false;
      }
      if (okay) return;
      
      var message;
      if (constructor) {
        message = new JS.Test.Unit.AssertionMessage('Mock expectation not met',
                      '<?> expected to be constructed with\n(?)' +
                      (extraMessage ? '\n' + extraMessage : ''),
                      [object, this.toArray()]);
      } else {
        message = new JS.Test.Unit.AssertionMessage('Mock expectation not met',
                      '<?> expected to receive call\n' + methodName + '(?)' +
                      (extraMessage ? '\n' + extraMessage : ''),
                      [object, this.toArray()]);
      }
      
      throw new JS.Test.Mocking.ExpectationError(message);
    },
    
    _createMessage: function(type) {
      var actual = this._callsMade,
          report = 'but ' + actual + ' call' + (actual === 1 ? ' was' : 's were') + ' made';
      
      var copy = {
        'exactly':   this._expectedCalls,
        'at most':   this._maximumCalls,
        'at least':  this._minimumCalls
      };
      return type + ' ' + copy[type] + ' times\n' + report;
    }
  })
});


JS.Test.Mocking.extend({
  Anything: new JS.Class({
    equals: function() { return true },
    toString: function() { return 'anything' }
  }),
  
  AnyArgs: new JS.Class({
    equals: function() { return JS.Enumerable.ALL_EQUAL },
    toString: function() { return '*arguments' }
  }),
  
  ArrayIncluding: new JS.Class({
    initialize: function(elements) {
      this._elements = Array.prototype.slice.call(elements);
    },
    
    equals: function(array) {
      if (!JS.isType(array, Array)) return false;
      var i = this._elements.length, j;
      loop: while (i--) {
        j = array.length;
        while (j--) {
          if (JS.Enumerable.areEqual(this._elements[i], array[j]))
            continue loop;
        }
        return false;
      }
      return true;
    },
    
    toString: function() {
      var name = JS.Console.convert(this._elements);
      return 'arrayIncluding(' + name + ')';
    }
  }),
  
  ObjectIncluding: new JS.Class({
    initialize: function(elements) {
      this._elements = elements;
    },
    
    equals: function(object) {
      if (!JS.isType(object, Object)) return false;
      for (var key in this._elements) {
        if (!JS.Enumerable.areEqual(this._elements[key], object[key]))
          return false;
      }
      return true;
    },
    
    toString: function() {
      var name = JS.Console.convert(this._elements);
      return 'objectIncluding(' + name + ')';
    }
  }),
  
  InstanceOf: new JS.Class({
    initialize: function(type) {
      this._type = type;
    },
    
    equals: function(object) {
      return JS.isType(object, this._type);
    },
    
    toString: function() {
      var name = JS.Console.convert(this._type),
          an   = /^[aeiou]/i.test(name) ? 'an' : 'a';
      return an + '(' + name + ')';
    }
  }),
  
  Matcher: new JS.Class({
    initialize: function(type) {
      this._type = type;
    },
    
    equals: function(object) {
      return JS.match(this._type, object);
    },
    
    toString: function() {
      var name = JS.Console.convert(this._type);
      return 'matching(' + name + ')';
    }
  })
});


JS.Test.Mocking.Stub.include({
  given: function() {
    var matcher = new JS.Test.Mocking.Parameters(arguments, this._expected);
    this._argMatchers.push(matcher);
    this._currentMatcher = matcher;
    return this;
  },
  
  raises: function(exception) {
    this._currentMatcher._exception = exception;
    return this;
  },
  
  returns: function() {
    this._currentMatcher.returns(arguments);
    return this;
  },
  
  yields: function() {
    this._currentMatcher.yields(arguments);
    return this;
  },
  
  atLeast: function(n) {
    this._currentMatcher.setMinimum(n);
    return this;
  },
  
  atMost: function(n) {
    this._currentMatcher.setMaximum(n);
    return this;
  },
  
  exactly: function(n) {
    this._currentMatcher.setExpected(n);
    return this;
  }
});

JS.Test.Mocking.Stub.alias({
  raising:    'raises',
  returning:  'returns',
  yielding:   'yields'
});

JS.Test.Mocking.extend({      
  DSL: new JS.Module({
    stub: function() {
      return JS.Test.Mocking.stub.apply(JS.Test.Mocking, arguments);
    },
    
    expect: function() {
      var stub = JS.Test.Mocking.stub.apply(JS.Test.Mocking, arguments);
      stub.expected();
      this.addAssertion();
      return stub;
    },
    
    anything: function() {
      return new JS.Test.Mocking.Anything();
    },
    
    anyArgs: function() {
      return new JS.Test.Mocking.AnyArgs();
    },
    
    instanceOf: function(type) {
      return new JS.Test.Mocking.InstanceOf(type);
    },
    
    match: function(type) {
      return new JS.Test.Mocking.Matcher(type);
    },
    
    arrayIncluding: function() {
      return new JS.Test.Mocking.ArrayIncluding(arguments);
    },
    
    objectIncluding: function(elements) {
      return new JS.Test.Mocking.ObjectIncluding(elements);
    }
  })
});

JS.Test.Unit.TestCase.include(JS.Test.Mocking.DSL);
JS.Test.Unit.mocking = JS.Test.Mocking;


JS.Test.extend({
  AsyncSteps: new JS.Class(JS.Module, {
    define: function(name, method) {
      this.callSuper(name, function() {
        var args = [name, method].concat(JS.array(arguments));
        this.__enqueue__(args);
      });
    },
    
    included: function(klass) {
      klass.include(JS.Test.AsyncSteps.Sync);
      if (!klass.includes(JS.Test.Context)) return;
      
      klass.after(function(resume) { this.sync(resume) });
      
      klass.extend({
        after: function(period, block) {
          if ((typeof period === 'function') || !block) {
            block  = period;
            period = 'each';
          }
          this.callSuper(function(resume) {
            this.sync(function() {
              this.exec(block, resume);
            });
          });
        }
      });
    },
    
    extend: {
      Sync: new JS.Module({
        __enqueue__: function(args) {
          this.__stepQueue__ = this.__stepQueue__ || [];
          this.__stepQueue__.push(args);
          if (this.__runningSteps__) return;
          this.__runningSteps__ = true;
          
          var setTimeout = JS.Test.Unit.TestSuite.setTimeout;
          setTimeout(this.method('__runNextStep__'), 1);
        },
        
        __runNextStep__: function() {
          var step = this.__stepQueue__.shift(), n;
          
          if (!step) {
            this.__runningSteps__ = false;
            if (!this.__stepCallbacks__) return;
            
            n = this.__stepCallbacks__.length;
            while (n--) this.__stepCallbacks__.shift().call(this);
            
            return;
          }
          
          var methodName = step.shift(),
              method     = step.shift(),
              parameters = step.slice(),
              block      = function() { method.apply(this, parameters) };
          
          parameters[method.length - 1] = this.method('__runNextStep__');
          if (!this.exec) return block.call(this);
          this.exec(block, function() {}, this.method('__endSteps__'));
        },

        __endSteps__: function() {
          this.__stepQueue__ = [];
          this.__runNextStep__();
        },
        
        addError: function() {
          this.callSuper();
          this.__endSteps__();
        },
        
        sync: function(callback) {
          if (!this.__runningSteps__) return callback.call(this);
          this.__stepCallbacks__ = this.__stepCallbacks__ || [];
          this.__stepCallbacks__.push(callback);
        }
      })
    }
  }),
  
  asyncSteps: function(methods) {
    return new this.AsyncSteps(methods);
  }
});


JS.Test.extend({
  FakeClock: new JS.Module({
    extend: {
      API: new JS.Singleton({
        stub: function() {
          var mocking = JS.Test.Mocking,
              methods = ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
              i       = methods.length;
          
          JS.Test.FakeClock.reset();
          
          while (i--)
            mocking.stub(methods[i], JS.Test.FakeClock.method(methods[i]));
          
          Date.now = function() { return new Date() };
        },
        
        reset: function() {
          return JS.Test.FakeClock.reset();
        },
        
        tick: function(milliseconds) {
          return JS.Test.FakeClock.tick(milliseconds);
        }
      }),
      
      JSDate: Date,
      
      Schedule: new JS.Class(JS.SortedSet, {
        nextScheduledAt: function(time) {
          return this.find(function(timeout) { return timeout.time <= time });
        }
      }),
      
      Timeout: new JS.Class({
        include: JS.Comparable,
        
        initialize: function(callback, interval, repeat) {
          this.callback = callback;
          this.interval = interval;
          this.repeat   = repeat;
        },
        
        compareTo: function(other) {
          return this.time - other.time;
        },
        
        toString: function() {
          return (this.repeat ? 'Interval' : 'Timeout') +
                '(' + this.interval + ')' +
                ':' + this.time;
        }
      }),
      
      reset: function() {
        this._currentTime = new Date().getTime();
        this._callTime    = this._currentTime;
        this._schedule    = new this.Schedule();
      },
      
      tick: function(milliseconds) {
        this._currentTime += milliseconds;
        var timeout;
        while (timeout = this._schedule.nextScheduledAt(this._currentTime))
          this._run(timeout);
        this._callTime = this._currentTime;
      },
      
      _run: function(timeout) {
        this._callTime = timeout.time;
        timeout.callback();
        
        if (timeout.repeat) {
          timeout.time += timeout.interval;
          this._schedule.rebuild();
        } else {
          this.clearTimeout(timeout);
        }
      },
      
      _timer: function(callback, milliseconds, repeat) {
        var timeout = new this.Timeout(callback, milliseconds, repeat);
        timeout.time = this._callTime + milliseconds;
        this._schedule.add(timeout);
        return timeout;
      },
      
      Date: function() {
        var date = new this.JSDate();
        date.setTime(this._callTime);
        return date;
      },
      
      setTimeout: function(callback, milliseconds) {
        return this._timer(callback, milliseconds, false);
      },
      
      setInterval: function(callback, milliseconds) {
        return this._timer(callback, milliseconds, true);
      },
      
      clearTimeout: function(timeout) {
        this._schedule.remove(timeout)
      },
      
      clearInterval: function(timeout) {
        this._schedule.remove(timeout);
      }
    }
  })
});

JS.Test.FakeClock.include({
  clock: JS.Test.FakeClock.API
});


JS.Test.extend({
  Coverage: new JS.Class({
    initialize: function(module) {
      this._module = module;
      this._methods = new JS.Hash([]);
      
      var storeMethods = function(module) {
        var methods = module.instanceMethods(false),
            i = methods.length;
        while (i--) this._methods.store(module.instanceMethod(methods[i]), 0);
      };
      storeMethods.call(this, module);
      storeMethods.call(this, module.__eigen__());
    },
    
    attach: function() {
      var module = this._module;
      JS.StackTrace.addObserver(this);
      JS.Method.trace([module, module.__eigen__()]);
    },
    
    detach: function() {
      var module = this._module;
      JS.Method.untrace([module, module.__eigen__()]);
      JS.StackTrace.removeObserver(this);
    },
    
    update: function(event, frame) {
      if (event !== 'call') return;
      var pair = this._methods.assoc(frame.method);
      if (pair) pair.setValue(pair.value + 1);
    },
    
    report: function() {
      var methods = this._methods.entries().sort(function(a,b) {
        return b.value - a.value;
      });
      var covered = this._methods.all(function(pair) { return pair.value > 0 });
      
      JS.Console.printTable(methods, function(row, i) {
        if (row[1] === 0) return ['bgred', 'white'];
        return (i % 2 === 0) ? ['bold'] : [];
      });
      return covered;
    }
  })
});

JS.Test.extend({
  Helpers: new JS.Module({
    $R: function(start, end) {
      return new JS.Range(start, end);
    },
    
    $w: function(string) {
      return string.split(/\s+/);
    },
    
    forEach: function(list, block, context) {
      for (var i = 0, n = list.length; i < n; i++) {
        block.call(context || null, list[i], i);
      }
    },
    
    its: function() {
      return new JS.MethodChain();
    },
    
    map: function(list, block, context) {
      return new JS.Enumerable.Collection(list).map(block, context)
    },
    
    repeat: function(n, block, context) {
      while (n--) block.call(context);
    }
  })
});


JS.Test.extend({
  Runner: new JS.Class({
    initialize: function(settings) {
      this._settings = (typeof settings === 'string')
                     ? {format: settings}
                     : (settings || {});
    },
    
    run: function() {
      var ui = this.getUI(this._settings);
      ui.prepare(this.start, this);
    },
    
    start: function(ui) {
      var options   = ui.getOptions(),
          reporters = ui.getReporters(options),
          suite     = this.getSuite(options);
      
      JS.Test.setReporter(new JS.Test.Reporters.Composite(reporters), false);
      
      var startTime  = new Date().getTime();
          testResult = new JS.Test.Unit.TestResult(),
          TR         = JS.Test.Unit.TestResult,
          TS         = JS.Test.Unit.TestSuite,
          TC         = JS.Test.Unit.TestCase;
      
      var resultListener = testResult.addListener(TR.CHANGED, function() {
        var result = testResult.metadata(),
            time   = new Date().getTime();
        
        result.runtime = (time - startTime) / 1000;
        JS.Test.reporter.update(result);
      });
      
      var faultListener = testResult.addListener(TR.FAULT, function(fault) {
        JS.Test.reporter.addFault(fault.metadata());
      });
      
      var reportResult = function() {
        testResult.removeListener(TR.CHANGED, resultListener);
        testResult.removeListener(TR.FAULT, faultListener);
        
        var endTime     = new Date().getTime(),
            elapsedTime = (endTime - startTime) / 1000;
        
        // TODO output reports
        var result = testResult.metadata();
        result.runtime = elapsedTime;
        JS.Test.reporter.endRun(result);        
      };
      
      var reportEvent = function(channel, testCase) {
        if (channel === TS.STARTED)
          JS.Test.reporter.startSuite();
        else if (channel === TC.STARTED)
          JS.Test.reporter.startTest(testCase.metadata());
        else if (channel === TC.FINISHED)
          JS.Test.reporter.endTest(testCase.metadata());
        else if (channel === TS.FINISHED)
          JS.Test.reporter.endSuite();
      };
      
      JS.Test.reporter.startRun({suites: suite.toString()});
      
      suite.run(testResult, reportResult, reportEvent, this);
    },
    
    getUI: function(settings) {
      if (JS.Console.BROWSER)
        return new JS.Test.UI.Browser(settings);
      else
        return new JS.Test.UI.Terminal(settings);
    },
    
    getSuite: function(options) {
      var filter = options.test,
          names  = [],
          suites = [];
      
      JS.Test.Unit.TestCase.resolve();
      
      JS.Test.Unit.TestCase.forEach(function(testcase) {
        var suite = testcase.suite(filter);
        if (suite.size() > 0) suites.push(suite);
        if (testcase.superclass === JS.Test.Unit.TestCase)
          names.push(testcase.displayName);
      });
      
      var suite = new JS.Test.Unit.TestSuite(names);
      for (var i = 0, n = suites.length; i < n; i++)
        suite.push(suites[i]);
      
      JS.Test.Unit.TestCase.clear();
      return suite;
    },
    
    extend: {
      filter: function(objects, suffix) {
        var filter = [], // TODO implement this
            output = [],
            n      = filter.length,
            m, object;
        
        if (n === 0) return objects;
        
        while (n--) {
          m = objects.length;
          while (m--) {
            object = objects[m].replace(new RegExp(suffix + '$'), '');
            if (filter[n].substr(0, object.length) === object)
              output.push(objects[m]);
          }
        }
        return output;
      }
    }
  }),
  
  autorun: function(options) {
    var runner = new JS.Test.Runner(options);
    runner.run();
  }
});
