var KillrVideo =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/assets/js/";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.sticky = undefined;
	
	var _cashDom = __webpack_require__(1);
	
	var _cashDom2 = _interopRequireDefault(_cashDom);
	
	var _sticky = __webpack_require__(2);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	// Include Google Analytics when in production
	if (true) {
	  var ga = __webpack_require__(4);
	}
	
	// Add listeners for click on mobile menu
	var $mainNavMenu = (0, _cashDom2.default)('header > nav.nav div.nav-menu');
	(0, _cashDom2.default)('header > nav.nav span.nav-toggle').on('click', function toggleMenuActive(e) {
	  $mainNavMenu.toggleClass('is-active');
	});
	
	exports.sticky = _sticky.sticky;

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_RESULT__;"use strict";
	
	/*! cash-dom 1.3.7, https://github.com/kenwheeler/cash @license MIT */
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
	
	;(function (root, factory) {
	  if (true) {
	    !(__WEBPACK_AMD_DEFINE_FACTORY__ = (factory), __WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ? (__WEBPACK_AMD_DEFINE_FACTORY__.call(exports, __webpack_require__, exports, module)) : __WEBPACK_AMD_DEFINE_FACTORY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	  } else if (typeof exports !== "undefined") {
	    module.exports = factory();
	  } else {
	    root.cash = root.$ = factory();
	  }
	})(undefined, function () {
	  var doc = document,
	      win = window,
	      ArrayProto = Array.prototype,
	      slice = ArrayProto.slice,
	      _filter = ArrayProto.filter,
	      push = ArrayProto.push;
	
	  var noop = function noop() {},
	      isFunction = function isFunction(item) {
	    // @see https://crbug.com/568448
	    return (typeof item === "undefined" ? "undefined" : _typeof(item)) === (typeof noop === "undefined" ? "undefined" : _typeof(noop)) && item.call;
	  },
	      isString = function isString(item) {
	    return (typeof item === "undefined" ? "undefined" : _typeof(item)) === _typeof("");
	  };
	
	  var idMatch = /^#[\w-]*$/,
	      classMatch = /^\.[\w-]*$/,
	      htmlMatch = /<.+>/,
	      singlet = /^\w+$/;
	
	  function _find(selector, context) {
	    context = context || doc;
	    var elems = classMatch.test(selector) ? context.getElementsByClassName(selector.slice(1)) : singlet.test(selector) ? context.getElementsByTagName(selector) : context.querySelectorAll(selector);
	    return elems;
	  }
	
	  var frag;
	  function parseHTML(str) {
	    if (!frag) {
	      frag = doc.implementation.createHTMLDocument(null);
	      var base = frag.createElement("base");
	      base.href = doc.location.href;
	      frag.head.appendChild(base);
	    }
	
	    frag.body.innerHTML = str;
	
	    return frag.body.childNodes;
	  }
	
	  function onReady(fn) {
	    if (doc.readyState !== "loading") {
	      setTimeout(fn);
	    } else {
	      doc.addEventListener("DOMContentLoaded", fn);
	    }
	  }
	
	  function Init(selector, context) {
	    if (!selector) {
	      return this;
	    }
	
	    // If already a cash collection, don't do any further processing
	    if (selector.cash && selector !== win) {
	      return selector;
	    }
	
	    var elems = selector,
	        i = 0,
	        length;
	
	    if (isString(selector)) {
	      elems = idMatch.test(selector) ?
	      // If an ID use the faster getElementById check
	      doc.getElementById(selector.slice(1)) : htmlMatch.test(selector) ?
	      // If HTML, parse it into real elements
	      parseHTML(selector) :
	      // else use `find`
	      _find(selector, context);
	
	      // If function, use as shortcut for DOM ready
	    } else if (isFunction(selector)) {
	      onReady(selector);return this;
	    }
	
	    if (!elems) {
	      return this;
	    }
	
	    // If a single DOM element is passed in or received via ID, return the single element
	    if (elems.nodeType || elems === win) {
	      this[0] = elems;
	      this.length = 1;
	    } else {
	      // Treat like an array and loop through each item.
	      length = this.length = elems.length;
	      for (; i < length; i++) {
	        this[i] = elems[i];
	      }
	    }
	
	    return this;
	  }
	
	  function cash(selector, context) {
	    return new Init(selector, context);
	  }
	
	  var fn = cash.fn = cash.prototype = Init.prototype = { // jshint ignore:line
	    cash: true,
	    length: 0,
	    push: push,
	    splice: ArrayProto.splice,
	    map: ArrayProto.map,
	    init: Init
	  };
	
	  Object.defineProperty(fn, "constructor", { value: cash });
	
	  cash.parseHTML = parseHTML;
	  cash.noop = noop;
	  cash.isFunction = isFunction;
	  cash.isString = isString;
	
	  cash.extend = fn.extend = function (target) {
	    target = target || {};
	
	    var args = slice.call(arguments),
	        length = args.length,
	        i = 1;
	
	    if (args.length === 1) {
	      target = this;
	      i = 0;
	    }
	
	    for (; i < length; i++) {
	      if (!args[i]) {
	        continue;
	      }
	      for (var key in args[i]) {
	        if (args[i].hasOwnProperty(key)) {
	          target[key] = args[i][key];
	        }
	      }
	    }
	
	    return target;
	  };
	
	  function _each(collection, callback) {
	    var l = collection.length,
	        i = 0;
	
	    for (; i < l; i++) {
	      if (callback.call(collection[i], collection[i], i, collection) === false) {
	        break;
	      }
	    }
	  }
	
	  function matches(el, selector) {
	    var m = el && (el.matches || el.webkitMatchesSelector || el.mozMatchesSelector || el.msMatchesSelector || el.oMatchesSelector);
	    return !!m && m.call(el, selector);
	  }
	
	  function getCompareFunction(selector) {
	    return (
	      /* Use browser's `matches` function if string */
	      isString(selector) ? matches :
	      /* Match a cash element */
	      selector.cash ? function (el) {
	        return selector.is(el);
	      } :
	      /* Direct comparison */
	      function (el, selector) {
	        return el === selector;
	      }
	    );
	  }
	
	  function unique(collection) {
	    return cash(slice.call(collection).filter(function (item, index, self) {
	      return self.indexOf(item) === index;
	    }));
	  }
	
	  cash.extend({
	    merge: function merge(first, second) {
	      var len = +second.length,
	          i = first.length,
	          j = 0;
	
	      for (; j < len; i++, j++) {
	        first[i] = second[j];
	      }
	
	      first.length = i;
	      return first;
	    },
	
	    each: _each,
	    matches: matches,
	    unique: unique,
	    isArray: Array.isArray,
	    isNumeric: function isNumeric(n) {
	      return !isNaN(parseFloat(n)) && isFinite(n);
	    }
	
	  });
	
	  var uid = cash.uid = "_cash" + Date.now();
	
	  function getDataCache(node) {
	    return node[uid] = node[uid] || {};
	  }
	
	  function setData(node, key, value) {
	    return getDataCache(node)[key] = value;
	  }
	
	  function getData(node, key) {
	    var c = getDataCache(node);
	    if (c[key] === undefined) {
	      c[key] = node.dataset ? node.dataset[key] : cash(node).attr("data-" + key);
	    }
	    return c[key];
	  }
	
	  function _removeData(node, key) {
	    var c = getDataCache(node);
	    if (c) {
	      delete c[key];
	    } else if (node.dataset) {
	      delete node.dataset[key];
	    } else {
	      cash(node).removeAttr("data-" + name);
	    }
	  }
	
	  fn.extend({
	    data: function data(name, value) {
	      if (isString(name)) {
	        return value === undefined ? getData(this[0], name) : this.each(function (v) {
	          return setData(v, name, value);
	        });
	      }
	
	      for (var key in name) {
	        this.data(key, name[key]);
	      }
	
	      return this;
	    },
	
	    removeData: function removeData(key) {
	      return this.each(function (v) {
	        return _removeData(v, key);
	      });
	    }
	
	  });
	
	  var notWhiteMatch = /\S+/g;
	
	  function getClasses(c) {
	    return isString(c) && c.match(notWhiteMatch);
	  }
	
	  function _hasClass(v, c) {
	    return v.classList ? v.classList.contains(c) : new RegExp("(^| )" + c + "( |$)", "gi").test(v.className);
	  }
	
	  function _addClass(v, c) {
	    if (v.classList) {
	      v.classList.add(c);
	    } else if (!_hasClass(v, c)) {
	      v.className += " " + c;
	    }
	  }
	
	  function _removeClass(v, c) {
	    if (v.classList) {
	      v.classList.remove(c);
	    } else {
	      v.className = v.className.replace(c, "");
	    }
	  }
	
	  fn.extend({
	    addClass: function addClass(c) {
	      var classes = getClasses(c);
	
	      return classes ? this.each(function (v) {
	        _each(classes, function (c) {
	          _addClass(v, c);
	        });
	      }) : this;
	    },
	
	    attr: function attr(name, value) {
	      if (!name) {
	        return undefined;
	      }
	
	      if (isString(name)) {
	        if (value === undefined) {
	          return this[0] ? this[0].getAttribute ? this[0].getAttribute(name) : this[0][name] : undefined;
	        }
	
	        return this.each(function (v) {
	          if (v.setAttribute) {
	            v.setAttribute(name, value);
	          } else {
	            v[name] = value;
	          }
	        });
	      }
	
	      for (var key in name) {
	        this.attr(key, name[key]);
	      }
	
	      return this;
	    },
	
	    hasClass: function hasClass(c) {
	      var check = false,
	          classes = getClasses(c);
	      if (classes && classes.length) {
	        this.each(function (v) {
	          check = _hasClass(v, classes[0]);
	          return !check;
	        });
	      }
	      return check;
	    },
	
	    prop: function prop(name, value) {
	      if (isString(name)) {
	        return value === undefined ? this[0][name] : this.each(function (v) {
	          v[name] = value;
	        });
	      }
	
	      for (var key in name) {
	        this.prop(key, name[key]);
	      }
	
	      return this;
	    },
	
	    removeAttr: function removeAttr(name) {
	      return this.each(function (v) {
	        if (v.removeAttribute) {
	          v.removeAttribute(name);
	        } else {
	          delete v[name];
	        }
	      });
	    },
	
	    removeClass: function removeClass(c) {
	      if (!arguments.length) {
	        return this.attr("class", "");
	      }
	      var classes = getClasses(c);
	      return classes ? this.each(function (v) {
	        _each(classes, function (c) {
	          _removeClass(v, c);
	        });
	      }) : this;
	    },
	
	    removeProp: function removeProp(name) {
	      return this.each(function (v) {
	        delete v[name];
	      });
	    },
	
	    toggleClass: function toggleClass(c, state) {
	      if (state !== undefined) {
	        return this[state ? "addClass" : "removeClass"](c);
	      }
	      var classes = getClasses(c);
	      return classes ? this.each(function (v) {
	        _each(classes, function (c) {
	          if (_hasClass(v, c)) {
	            _removeClass(v, c);
	          } else {
	            _addClass(v, c);
	          }
	        });
	      }) : this;
	    } });
	
	  fn.extend({
	    add: function add(selector, context) {
	      return unique(cash.merge(this, cash(selector, context)));
	    },
	
	    each: function each(callback) {
	      _each(this, callback);
	      return this;
	    },
	
	    eq: function eq(index) {
	      return cash(this.get(index));
	    },
	
	    filter: function filter(selector) {
	      if (!selector) {
	        return this;
	      }
	
	      var comparator = isFunction(selector) ? selector : getCompareFunction(selector);
	
	      return cash(_filter.call(this, function (e) {
	        return comparator(e, selector);
	      }));
	    },
	
	    first: function first() {
	      return this.eq(0);
	    },
	
	    get: function get(index) {
	      if (index === undefined) {
	        return slice.call(this);
	      }
	      return index < 0 ? this[index + this.length] : this[index];
	    },
	
	    index: function index(elem) {
	      var child = elem ? cash(elem)[0] : this[0],
	          collection = elem ? this : cash(child).parent().children();
	      return slice.call(collection).indexOf(child);
	    },
	
	    last: function last() {
	      return this.eq(-1);
	    }
	
	  });
	
	  var camelCase = function () {
	    var camelRegex = /(?:^\w|[A-Z]|\b\w)/g,
	        whiteSpace = /[\s-_]+/g;
	    return function (str) {
	      return str.replace(camelRegex, function (letter, index) {
	        return letter[index === 0 ? "toLowerCase" : "toUpperCase"]();
	      }).replace(whiteSpace, "");
	    };
	  }();
	
	  var getPrefixedProp = function () {
	    var cache = {},
	        doc = document,
	        div = doc.createElement("div"),
	        style = div.style;
	
	    return function (prop) {
	      prop = camelCase(prop);
	      if (cache[prop]) {
	        return cache[prop];
	      }
	
	      var ucProp = prop.charAt(0).toUpperCase() + prop.slice(1),
	          prefixes = ["webkit", "moz", "ms", "o"],
	          props = (prop + " " + prefixes.join(ucProp + " ") + ucProp).split(" ");
	
	      _each(props, function (p) {
	        if (p in style) {
	          cache[p] = prop = cache[prop] = p;
	          return false;
	        }
	      });
	
	      return cache[prop];
	    };
	  }();
	
	  cash.prefixedProp = getPrefixedProp;
	  cash.camelCase = camelCase;
	
	  fn.extend({
	    css: function css(prop, value) {
	      if (isString(prop)) {
	        prop = getPrefixedProp(prop);
	        return arguments.length > 1 ? this.each(function (v) {
	          return v.style[prop] = value;
	        }) : win.getComputedStyle(this[0])[prop];
	      }
	
	      for (var key in prop) {
	        this.css(key, prop[key]);
	      }
	
	      return this;
	    }
	
	  });
	
	  function compute(el, prop) {
	    return parseInt(win.getComputedStyle(el[0], null)[prop], 10) || 0;
	  }
	
	  _each(["Width", "Height"], function (v) {
	    var lower = v.toLowerCase();
	
	    fn[lower] = function () {
	      return this[0].getBoundingClientRect()[lower];
	    };
	
	    fn["inner" + v] = function () {
	      return this[0]["client" + v];
	    };
	
	    fn["outer" + v] = function (margins) {
	      return this[0]["offset" + v] + (margins ? compute(this, "margin" + (v === "Width" ? "Left" : "Top")) + compute(this, "margin" + (v === "Width" ? "Right" : "Bottom")) : 0);
	    };
	  });
	
	  function registerEvent(node, eventName, callback) {
	    var eventCache = getData(node, "_cashEvents") || setData(node, "_cashEvents", {});
	    eventCache[eventName] = eventCache[eventName] || [];
	    eventCache[eventName].push(callback);
	    node.addEventListener(eventName, callback);
	  }
	
	  function removeEvent(node, eventName, callback) {
	    var events = getData(node, "_cashEvents"),
	        eventCache = events && events[eventName],
	        index;
	
	    if (!eventCache) {
	      return;
	    }
	
	    if (callback) {
	      node.removeEventListener(eventName, callback);
	      index = eventCache.indexOf(callback);
	      if (index >= 0) {
	        eventCache.splice(index, 1);
	      }
	    } else {
	      _each(eventCache, function (event) {
	        node.removeEventListener(eventName, event);
	      });
	      eventCache = [];
	    }
	  }
	
	  fn.extend({
	    off: function off(eventName, callback) {
	      return this.each(function (v) {
	        return removeEvent(v, eventName, callback);
	      });
	    },
	
	    on: function on(eventName, delegate, callback, runOnce) {
	      // jshint ignore:line
	
	      var originalCallback;
	
	      if (!isString(eventName)) {
	        for (var key in eventName) {
	          this.on(key, delegate, eventName[key]);
	        }
	        return this;
	      }
	
	      if (isFunction(delegate)) {
	        callback = delegate;
	        delegate = null;
	      }
	
	      if (eventName === "ready") {
	        onReady(callback);
	        return this;
	      }
	
	      if (delegate) {
	        originalCallback = callback;
	        callback = function callback(e) {
	          var t = e.target;
	
	          while (!matches(t, delegate)) {
	            if (t === this) {
	              return t = false;
	            }
	            t = t.parentNode;
	          }
	
	          if (t) {
	            originalCallback.call(t, e);
	          }
	        };
	      }
	
	      return this.each(function (v) {
	        var _finalCallback = callback;
	        if (runOnce) {
	          _finalCallback = function finalCallback() {
	            callback.apply(this, arguments);
	            removeEvent(v, eventName, _finalCallback);
	          };
	        }
	        registerEvent(v, eventName, _finalCallback);
	      });
	    },
	
	    one: function one(eventName, delegate, callback) {
	      return this.on(eventName, delegate, callback, true);
	    },
	
	    ready: onReady,
	
	    trigger: function trigger(eventName, data) {
	      var evt = doc.createEvent("HTMLEvents");
	      evt.data = data;
	      evt.initEvent(eventName, true, false);
	      return this.each(function (v) {
	        return v.dispatchEvent(evt);
	      });
	    }
	
	  });
	
	  function encode(name, value) {
	    return "&" + encodeURIComponent(name) + "=" + encodeURIComponent(value).replace(/%20/g, "+");
	  }
	
	  function getSelectMultiple_(el) {
	    var values = [];
	    _each(el.options, function (o) {
	      if (o.selected) {
	        values.push(o.value);
	      }
	    });
	    return values.length ? values : null;
	  }
	
	  function getSelectSingle_(el) {
	    var selectedIndex = el.selectedIndex;
	    return selectedIndex >= 0 ? el.options[selectedIndex].value : null;
	  }
	
	  function getValue(el) {
	    var type = el.type;
	    if (!type) {
	      return null;
	    }
	    switch (type.toLowerCase()) {
	      case "select-one":
	        return getSelectSingle_(el);
	      case "select-multiple":
	        return getSelectMultiple_(el);
	      case "radio":
	        return el.checked ? el.value : null;
	      case "checkbox":
	        return el.checked ? el.value : null;
	      default:
	        return el.value ? el.value : null;
	    }
	  }
	
	  fn.extend({
	    serialize: function serialize() {
	      var query = "";
	
	      _each(this[0].elements || this, function (el) {
	        if (el.disabled || el.tagName === "FIELDSET") {
	          return;
	        }
	        var name = el.name;
	        switch (el.type.toLowerCase()) {
	          case "file":
	          case "reset":
	          case "submit":
	          case "button":
	            break;
	          case "select-multiple":
	            var values = getValue(el);
	            if (values !== null) {
	              _each(values, function (value) {
	                query += encode(name, value);
	              });
	            }
	            break;
	          default:
	            var value = getValue(el);
	            if (value !== null) {
	              query += encode(name, value);
	            }
	        }
	      });
	
	      return query.substr(1);
	    },
	
	    val: function val(value) {
	      if (value === undefined) {
	        return getValue(this[0]);
	      } else {
	        return this.each(function (v) {
	          return v.value = value;
	        });
	      }
	    }
	
	  });
	
	  function insertElement(el, child, prepend) {
	    if (prepend) {
	      var first = el.childNodes[0];
	      el.insertBefore(child, first);
	    } else {
	      el.appendChild(child);
	    }
	  }
	
	  function insertContent(parent, child, prepend) {
	    var str = isString(child);
	
	    if (!str && child.length) {
	      _each(child, function (v) {
	        return insertContent(parent, v, prepend);
	      });
	      return;
	    }
	
	    _each(parent, str ? function (v) {
	      return v.insertAdjacentHTML(prepend ? "afterbegin" : "beforeend", child);
	    } : function (v, i) {
	      return insertElement(v, i === 0 ? child : child.cloneNode(true), prepend);
	    });
	  }
	
	  fn.extend({
	    after: function after(selector) {
	      cash(selector).insertAfter(this);
	      return this;
	    },
	
	    append: function append(content) {
	      insertContent(this, content);
	      return this;
	    },
	
	    appendTo: function appendTo(parent) {
	      insertContent(cash(parent), this);
	      return this;
	    },
	
	    before: function before(selector) {
	      cash(selector).insertBefore(this);
	      return this;
	    },
	
	    clone: function clone() {
	      return cash(this.map(function (v) {
	        return v.cloneNode(true);
	      }));
	    },
	
	    empty: function empty() {
	      this.html("");
	      return this;
	    },
	
	    html: function html(content) {
	      if (content === undefined) {
	        return this[0].innerHTML;
	      }
	      var source = content.nodeType ? content[0].outerHTML : content;
	      return this.each(function (v) {
	        return v.innerHTML = source;
	      });
	    },
	
	    insertAfter: function insertAfter(selector) {
	      var _this = this;
	
	      cash(selector).each(function (el, i) {
	        var parent = el.parentNode,
	            sibling = el.nextSibling;
	        _this.each(function (v) {
	          parent.insertBefore(i === 0 ? v : v.cloneNode(true), sibling);
	        });
	      });
	
	      return this;
	    },
	
	    insertBefore: function insertBefore(selector) {
	      var _this2 = this;
	      cash(selector).each(function (el, i) {
	        var parent = el.parentNode;
	        _this2.each(function (v) {
	          parent.insertBefore(i === 0 ? v : v.cloneNode(true), el);
	        });
	      });
	      return this;
	    },
	
	    prepend: function prepend(content) {
	      insertContent(this, content, true);
	      return this;
	    },
	
	    prependTo: function prependTo(parent) {
	      insertContent(cash(parent), this, true);
	      return this;
	    },
	
	    remove: function remove() {
	      return this.each(function (v) {
	        return v.parentNode.removeChild(v);
	      });
	    },
	
	    text: function text(content) {
	      if (content === undefined) {
	        return this[0].textContent;
	      }
	      return this.each(function (v) {
	        return v.textContent = content;
	      });
	    }
	
	  });
	
	  var docEl = doc.documentElement;
	
	  fn.extend({
	    position: function position() {
	      var el = this[0];
	      return {
	        left: el.offsetLeft,
	        top: el.offsetTop
	      };
	    },
	
	    offset: function offset() {
	      var rect = this[0].getBoundingClientRect();
	      return {
	        top: rect.top + win.pageYOffset - docEl.clientTop,
	        left: rect.left + win.pageXOffset - docEl.clientLeft
	      };
	    },
	
	    offsetParent: function offsetParent() {
	      return cash(this[0].offsetParent);
	    }
	
	  });
	
	  fn.extend({
	    children: function children(selector) {
	      var elems = [];
	      this.each(function (el) {
	        push.apply(elems, el.children);
	      });
	      elems = unique(elems);
	
	      return !selector ? elems : elems.filter(function (v) {
	        return matches(v, selector);
	      });
	    },
	
	    closest: function closest(selector) {
	      if (!selector || this.length < 1) {
	        return cash();
	      }
	      if (this.is(selector)) {
	        return this.filter(selector);
	      }
	      return this.parent().closest(selector);
	    },
	
	    is: function is(selector) {
	      if (!selector) {
	        return false;
	      }
	
	      var match = false,
	          comparator = getCompareFunction(selector);
	
	      this.each(function (el) {
	        match = comparator(el, selector);
	        return !match;
	      });
	
	      return match;
	    },
	
	    find: function find(selector) {
	      if (!selector || selector.nodeType) {
	        return cash(selector && this.has(selector).length ? selector : null);
	      }
	
	      var elems = [];
	      this.each(function (el) {
	        push.apply(elems, _find(selector, el));
	      });
	
	      return unique(elems);
	    },
	
	    has: function has(selector) {
	      var comparator = isString(selector) ? function (el) {
	        return _find(selector, el).length !== 0;
	      } : function (el) {
	        return el.contains(selector);
	      };
	
	      return this.filter(comparator);
	    },
	
	    next: function next() {
	      return cash(this[0].nextElementSibling);
	    },
	
	    not: function not(selector) {
	      if (!selector) {
	        return this;
	      }
	
	      var comparator = getCompareFunction(selector);
	
	      return this.filter(function (el) {
	        return !comparator(el, selector);
	      });
	    },
	
	    parent: function parent() {
	      var result = [];
	
	      this.each(function (item) {
	        if (item && item.parentNode) {
	          result.push(item.parentNode);
	        }
	      });
	
	      return unique(result);
	    },
	
	    parents: function parents(selector) {
	      var last,
	          result = [];
	
	      this.each(function (item) {
	        last = item;
	
	        while (last && last.parentNode && last !== doc.body.parentNode) {
	          last = last.parentNode;
	
	          if (!selector || selector && matches(last, selector)) {
	            result.push(last);
	          }
	        }
	      });
	
	      return unique(result);
	    },
	
	    prev: function prev() {
	      return cash(this[0].previousElementSibling);
	    },
	
	    siblings: function siblings() {
	      var collection = this.parent().children(),
	          el = this[0];
	
	      return collection.filter(function (i) {
	        return i !== el;
	      });
	    }
	
	  });
	
	  return cash;
	});

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.sticky = sticky;
	
	var _cashDom = __webpack_require__(1);
	
	var _cashDom2 = _interopRequireDefault(_cashDom);
	
	var _lodash = __webpack_require__(3);
	
	var _lodash2 = _interopRequireDefault(_lodash);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	/**
	 * Helper function to determine whether or not the current page is being viewed in a mobile 
	 * width (consistent with the breakpoints in our SASS).
	 */
	function getMobile() {
	  var viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
	  return viewportWidth <= 768;
	}
	
	/**
	 * Helper function to get the current scroll position of the page.
	 */
	function getPosition() {
	  return window.pageYOffset || document.documentElement.scrollTop;
	}
	
	/**
	 * Helper function that determines whether given a scroll threshold, we should be putting
	 * sticky elements into fixed positioning.
	 */
	function shouldBeFixedPosition(thresholdPx) {
	  var isMobile = getMobile();
	  if (isMobile) return false;
	
	  var position = getPosition();
	  if (position < thresholdPx) return false;
	
	  return true;
	}
	
	/**
	 * Simulate CSS sticky positioning on an element by reacting to window scroll and resize events,
	 * then adding a class to the specified element(s).
	 */
	function sticky(selector, thresholdPx, topPx) {
	  var $el = (0, _cashDom2.default)(selector);
	
	  // Insert a hidden div after the element we're going to make sticky
	  var $newDiv = (0, _cashDom2.default)(document.createElement('div')).css('height', '0px').insertAfter($el);
	
	  // Variable that contains state about whether or not we're in fixed position
	  var isFixed = false;
	
	  // Function that will update the width of the element to be the same as the hidden div
	  function updateWidth() {
	    if (isFixed === false) return;
	    $el.css('width', $newDiv.width() + 'px');
	  }
	
	  // Update width function, only throttled
	  var updateWidthOnResize = (0, _lodash2.default)(updateWidth, 100);
	
	  // The function we'll run as the UI is scrolled/resized to update our state
	  function updateFixed() {
	    // Check if we should be fixed position
	    var shouldBeFixed = shouldBeFixedPosition(thresholdPx);
	
	    // If already in the correct state, just bail
	    if (shouldBeFixed === isFixed) return;
	
	    // Update our state
	    isFixed = shouldBeFixed;
	
	    // Update the UI
	    if (isFixed === true) {
	      // Set to fixed position, update the element width, and update width on resizes
	      $el.css({ position: 'fixed', top: topPx + 'px' });
	      updateWidth();
	      (0, _cashDom2.default)(window).on('resize', updateWidthOnResize);
	    } else {
	      // Remove all style attributes and listeners
	      $el.removeAttr('style');
	      (0, _cashDom2.default)(window).off('resize', updateWidthOnResize);
	    }
	  }
	
	  // Update state on resize or scroll
	  (0, _cashDom2.default)(window).on('resize', (0, _lodash2.default)(updateFixed, 100)).on('scroll', (0, _lodash2.default)(updateFixed, 100));
	};

/***/ }),
/* 3 */
/***/ (function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {'use strict';
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
	
	/**
	 * lodash (Custom Build) <https://lodash.com/>
	 * Build: `lodash modularize exports="npm" -o ./`
	 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
	 * Released under MIT license <https://lodash.com/license>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 */
	
	/** Used as the `TypeError` message for "Functions" methods. */
	var FUNC_ERROR_TEXT = 'Expected a function';
	
	/** Used as references for various `Number` constants. */
	var NAN = 0 / 0;
	
	/** `Object#toString` result references. */
	var symbolTag = '[object Symbol]';
	
	/** Used to match leading and trailing whitespace. */
	var reTrim = /^\s+|\s+$/g;
	
	/** Used to detect bad signed hexadecimal string values. */
	var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
	
	/** Used to detect binary string values. */
	var reIsBinary = /^0b[01]+$/i;
	
	/** Used to detect octal string values. */
	var reIsOctal = /^0o[0-7]+$/i;
	
	/** Built-in method references without a dependency on `root`. */
	var freeParseInt = parseInt;
	
	/** Detect free variable `global` from Node.js. */
	var freeGlobal = (typeof global === 'undefined' ? 'undefined' : _typeof(global)) == 'object' && global && global.Object === Object && global;
	
	/** Detect free variable `self`. */
	var freeSelf = (typeof self === 'undefined' ? 'undefined' : _typeof(self)) == 'object' && self && self.Object === Object && self;
	
	/** Used as a reference to the global object. */
	var root = freeGlobal || freeSelf || Function('return this')();
	
	/** Used for built-in method references. */
	var objectProto = Object.prototype;
	
	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;
	
	/* Built-in method references for those with the same name as other `lodash` methods. */
	var nativeMax = Math.max,
	    nativeMin = Math.min;
	
	/**
	 * Gets the timestamp of the number of milliseconds that have elapsed since
	 * the Unix epoch (1 January 1970 00:00:00 UTC).
	 *
	 * @static
	 * @memberOf _
	 * @since 2.4.0
	 * @category Date
	 * @returns {number} Returns the timestamp.
	 * @example
	 *
	 * _.defer(function(stamp) {
	 *   console.log(_.now() - stamp);
	 * }, _.now());
	 * // => Logs the number of milliseconds it took for the deferred invocation.
	 */
	var now = function now() {
	  return root.Date.now();
	};
	
	/**
	 * Creates a debounced function that delays invoking `func` until after `wait`
	 * milliseconds have elapsed since the last time the debounced function was
	 * invoked. The debounced function comes with a `cancel` method to cancel
	 * delayed `func` invocations and a `flush` method to immediately invoke them.
	 * Provide `options` to indicate whether `func` should be invoked on the
	 * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
	 * with the last arguments provided to the debounced function. Subsequent
	 * calls to the debounced function return the result of the last `func`
	 * invocation.
	 *
	 * **Note:** If `leading` and `trailing` options are `true`, `func` is
	 * invoked on the trailing edge of the timeout only if the debounced function
	 * is invoked more than once during the `wait` timeout.
	 *
	 * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
	 * until to the next tick, similar to `setTimeout` with a timeout of `0`.
	 *
	 * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
	 * for details over the differences between `_.debounce` and `_.throttle`.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Function
	 * @param {Function} func The function to debounce.
	 * @param {number} [wait=0] The number of milliseconds to delay.
	 * @param {Object} [options={}] The options object.
	 * @param {boolean} [options.leading=false]
	 *  Specify invoking on the leading edge of the timeout.
	 * @param {number} [options.maxWait]
	 *  The maximum time `func` is allowed to be delayed before it's invoked.
	 * @param {boolean} [options.trailing=true]
	 *  Specify invoking on the trailing edge of the timeout.
	 * @returns {Function} Returns the new debounced function.
	 * @example
	 *
	 * // Avoid costly calculations while the window size is in flux.
	 * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
	 *
	 * // Invoke `sendMail` when clicked, debouncing subsequent calls.
	 * jQuery(element).on('click', _.debounce(sendMail, 300, {
	 *   'leading': true,
	 *   'trailing': false
	 * }));
	 *
	 * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
	 * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
	 * var source = new EventSource('/stream');
	 * jQuery(source).on('message', debounced);
	 *
	 * // Cancel the trailing debounced invocation.
	 * jQuery(window).on('popstate', debounced.cancel);
	 */
	function debounce(func, wait, options) {
	  var lastArgs,
	      lastThis,
	      maxWait,
	      result,
	      timerId,
	      lastCallTime,
	      lastInvokeTime = 0,
	      leading = false,
	      maxing = false,
	      trailing = true;
	
	  if (typeof func != 'function') {
	    throw new TypeError(FUNC_ERROR_TEXT);
	  }
	  wait = toNumber(wait) || 0;
	  if (isObject(options)) {
	    leading = !!options.leading;
	    maxing = 'maxWait' in options;
	    maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
	    trailing = 'trailing' in options ? !!options.trailing : trailing;
	  }
	
	  function invokeFunc(time) {
	    var args = lastArgs,
	        thisArg = lastThis;
	
	    lastArgs = lastThis = undefined;
	    lastInvokeTime = time;
	    result = func.apply(thisArg, args);
	    return result;
	  }
	
	  function leadingEdge(time) {
	    // Reset any `maxWait` timer.
	    lastInvokeTime = time;
	    // Start the timer for the trailing edge.
	    timerId = setTimeout(timerExpired, wait);
	    // Invoke the leading edge.
	    return leading ? invokeFunc(time) : result;
	  }
	
	  function remainingWait(time) {
	    var timeSinceLastCall = time - lastCallTime,
	        timeSinceLastInvoke = time - lastInvokeTime,
	        result = wait - timeSinceLastCall;
	
	    return maxing ? nativeMin(result, maxWait - timeSinceLastInvoke) : result;
	  }
	
	  function shouldInvoke(time) {
	    var timeSinceLastCall = time - lastCallTime,
	        timeSinceLastInvoke = time - lastInvokeTime;
	
	    // Either this is the first call, activity has stopped and we're at the
	    // trailing edge, the system time has gone backwards and we're treating
	    // it as the trailing edge, or we've hit the `maxWait` limit.
	    return lastCallTime === undefined || timeSinceLastCall >= wait || timeSinceLastCall < 0 || maxing && timeSinceLastInvoke >= maxWait;
	  }
	
	  function timerExpired() {
	    var time = now();
	    if (shouldInvoke(time)) {
	      return trailingEdge(time);
	    }
	    // Restart the timer.
	    timerId = setTimeout(timerExpired, remainingWait(time));
	  }
	
	  function trailingEdge(time) {
	    timerId = undefined;
	
	    // Only invoke if we have `lastArgs` which means `func` has been
	    // debounced at least once.
	    if (trailing && lastArgs) {
	      return invokeFunc(time);
	    }
	    lastArgs = lastThis = undefined;
	    return result;
	  }
	
	  function cancel() {
	    if (timerId !== undefined) {
	      clearTimeout(timerId);
	    }
	    lastInvokeTime = 0;
	    lastArgs = lastCallTime = lastThis = timerId = undefined;
	  }
	
	  function flush() {
	    return timerId === undefined ? result : trailingEdge(now());
	  }
	
	  function debounced() {
	    var time = now(),
	        isInvoking = shouldInvoke(time);
	
	    lastArgs = arguments;
	    lastThis = this;
	    lastCallTime = time;
	
	    if (isInvoking) {
	      if (timerId === undefined) {
	        return leadingEdge(lastCallTime);
	      }
	      if (maxing) {
	        // Handle invocations in a tight loop.
	        timerId = setTimeout(timerExpired, wait);
	        return invokeFunc(lastCallTime);
	      }
	    }
	    if (timerId === undefined) {
	      timerId = setTimeout(timerExpired, wait);
	    }
	    return result;
	  }
	  debounced.cancel = cancel;
	  debounced.flush = flush;
	  return debounced;
	}
	
	/**
	 * Creates a throttled function that only invokes `func` at most once per
	 * every `wait` milliseconds. The throttled function comes with a `cancel`
	 * method to cancel delayed `func` invocations and a `flush` method to
	 * immediately invoke them. Provide `options` to indicate whether `func`
	 * should be invoked on the leading and/or trailing edge of the `wait`
	 * timeout. The `func` is invoked with the last arguments provided to the
	 * throttled function. Subsequent calls to the throttled function return the
	 * result of the last `func` invocation.
	 *
	 * **Note:** If `leading` and `trailing` options are `true`, `func` is
	 * invoked on the trailing edge of the timeout only if the throttled function
	 * is invoked more than once during the `wait` timeout.
	 *
	 * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
	 * until to the next tick, similar to `setTimeout` with a timeout of `0`.
	 *
	 * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
	 * for details over the differences between `_.throttle` and `_.debounce`.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Function
	 * @param {Function} func The function to throttle.
	 * @param {number} [wait=0] The number of milliseconds to throttle invocations to.
	 * @param {Object} [options={}] The options object.
	 * @param {boolean} [options.leading=true]
	 *  Specify invoking on the leading edge of the timeout.
	 * @param {boolean} [options.trailing=true]
	 *  Specify invoking on the trailing edge of the timeout.
	 * @returns {Function} Returns the new throttled function.
	 * @example
	 *
	 * // Avoid excessively updating the position while scrolling.
	 * jQuery(window).on('scroll', _.throttle(updatePosition, 100));
	 *
	 * // Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
	 * var throttled = _.throttle(renewToken, 300000, { 'trailing': false });
	 * jQuery(element).on('click', throttled);
	 *
	 * // Cancel the trailing throttled invocation.
	 * jQuery(window).on('popstate', throttled.cancel);
	 */
	function throttle(func, wait, options) {
	  var leading = true,
	      trailing = true;
	
	  if (typeof func != 'function') {
	    throw new TypeError(FUNC_ERROR_TEXT);
	  }
	  if (isObject(options)) {
	    leading = 'leading' in options ? !!options.leading : leading;
	    trailing = 'trailing' in options ? !!options.trailing : trailing;
	  }
	  return debounce(func, wait, {
	    'leading': leading,
	    'maxWait': wait,
	    'trailing': trailing
	  });
	}
	
	/**
	 * Checks if `value` is the
	 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(_.noop);
	 * // => true
	 *
	 * _.isObject(null);
	 * // => false
	 */
	function isObject(value) {
	  var type = typeof value === 'undefined' ? 'undefined' : _typeof(value);
	  return !!value && (type == 'object' || type == 'function');
	}
	
	/**
	 * Checks if `value` is object-like. A value is object-like if it's not `null`
	 * and has a `typeof` result of "object".
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 * @example
	 *
	 * _.isObjectLike({});
	 * // => true
	 *
	 * _.isObjectLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isObjectLike(_.noop);
	 * // => false
	 *
	 * _.isObjectLike(null);
	 * // => false
	 */
	function isObjectLike(value) {
	  return !!value && (typeof value === 'undefined' ? 'undefined' : _typeof(value)) == 'object';
	}
	
	/**
	 * Checks if `value` is classified as a `Symbol` primitive or object.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
	 * @example
	 *
	 * _.isSymbol(Symbol.iterator);
	 * // => true
	 *
	 * _.isSymbol('abc');
	 * // => false
	 */
	function isSymbol(value) {
	  return (typeof value === 'undefined' ? 'undefined' : _typeof(value)) == 'symbol' || isObjectLike(value) && objectToString.call(value) == symbolTag;
	}
	
	/**
	 * Converts `value` to a number.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to process.
	 * @returns {number} Returns the number.
	 * @example
	 *
	 * _.toNumber(3.2);
	 * // => 3.2
	 *
	 * _.toNumber(Number.MIN_VALUE);
	 * // => 5e-324
	 *
	 * _.toNumber(Infinity);
	 * // => Infinity
	 *
	 * _.toNumber('3.2');
	 * // => 3.2
	 */
	function toNumber(value) {
	  if (typeof value == 'number') {
	    return value;
	  }
	  if (isSymbol(value)) {
	    return NAN;
	  }
	  if (isObject(value)) {
	    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
	    value = isObject(other) ? other + '' : other;
	  }
	  if (typeof value != 'string') {
	    return value === 0 ? value : +value;
	  }
	  value = value.replace(reTrim, '');
	  var isBinary = reIsBinary.test(value);
	  return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
	}
	
	module.exports = throttle;
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 4 */
/***/ (function(module, exports) {

	'use strict';
	
	(function (i, s, o, g, r, a, m) {
	  i['GoogleAnalyticsObject'] = r;i[r] = i[r] || function () {
	    (i[r].q = i[r].q || []).push(arguments);
	  }, i[r].l = 1 * new Date();a = s.createElement(o), m = s.getElementsByTagName(o)[0];a.async = 1;a.src = g;m.parentNode.insertBefore(a, m);
	})(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');
	
	ga('create', 'UA-54473346-2', 'auto');
	ga('send', 'pageview');

/***/ })
/******/ ]);
//# sourceMappingURL=bundle.js.map