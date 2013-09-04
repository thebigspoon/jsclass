(function(global) {
'use strict';

var DataNode = (function() {

  function Node(datum ) {
      return { "datum": datum };
  }

  return Node;

})();

var LinkedListDC =  function() {

  if(!this || !(this instanceof LinkedListDC)) {
	  return new LinkedListDC(arguments);
  }
}; // end constructor

 var insertTemplate = function(prev, next, pos) {
  return function(node, newNode) {
      if (node.list !== this) {
          return;
      }
    newNode[prev] = node;
    newNode[next] = node[next];
    node[next] = (node[next][prev] = newNode);
    if (newNode[prev] === this[pos]) this[pos] = newNode;
    newNode.list = this;
    this.length++;
      
      // if this is insertAfter, we just update 2 indexes
      // insertBefore requires all index updates
      if (prev === 'prev') { // insertAfter
          node.index = this.length - 2;
          newNode.index = this.length - 1;
      } else { // insertBefore
          var anode = this.first;
          for (var i = 0; i < this.length; i++) {

              anode.index = i;
              anode = anode.next;
          }
      }
  };
}; // end insertTemplate

LinkedListDC.prototype = {

  initialize: function(array, useNodes) {
    this.length = 0;
    this.first = this.last = null;
    if (!array) return;
      for (var i = 0, n = array.length; i < n; i++) {
          this.push(useNodes ? array[i] : array[i]);
      }
  },

  at: function(n) {
    if (n < 0 || n >= this.length) return undefined;
    var node = this.first;
    while (n--) node = node.next;
    return node;
  },

  pop: function() {
    return this.length ? this.remove(this.last) : undefined;
  },

  shift: function() {
    return this.length ? this.remove(this.first) : undefined;
  },
  
  insertAt: function(n, newNode) {
    if (n < 0 || n >= this.length) return;
    this.insertBefore(this.at(n), DataNode( newNode ) );
  },

  unshift: function (newNode) {
      newNode = DataNode(newNode);
    this.length > 0
        ? this.insertBefore(this.first, newNode)
        : this.push(newNode);
  },
  
  insertAfter : insertTemplate('prev', 'next', 'last'),
 
  insertBefore: insertTemplate('next', 'prev', 'first'),
  
  push: function (newNode) {
    newNode = DataNode(newNode);
    if (this.length)
      return this.insertAfter(this.last, newNode);

    // first insert logic
    this.first = this.last =
        newNode.prev = newNode.next = newNode;
    newNode.index = 0;
    newNode.list = this;
    this.length = 1;
  },

  remove: function(removed) {
    if (removed.list !== this || this.length === 0) return null;
    if (this.length > 1) {
      removed.prev.next = removed.next;
      removed.next.prev = removed.prev;
      if (removed === this.first) this.first = removed.next;
      if (removed === this.last) this.last = removed.prev;
    } else {
      this.first = this.last = null;
    }
    removed.prev = removed.next = removed.list = null;
    this.length--;
    return removed;
  }
 
 }; // end prototype definition
 

 // global should equal the windowS
global.LinkedListDC = LinkedListDC;

})(this);
