// Browser storage that never breaks the page: a file opened from disk, a private
// window or blocked storage just means nothing is remembered.
(function () {
  function read(kind, key) {
    try {
      return window[kind].getItem(key);
    } catch (err) {
      return null;
    }
  }

  function write(kind, key, value) {
    try {
      window[kind].setItem(key, value);
    } catch (err) {
      // nothing to do: the page works without storage
    }
  }

  AX.store = {
    get: function (key) {
      return read('localStorage', key);
    },
    set: function (key, value) {
      write('localStorage', key, value);
    },
    getSession: function (key) {
      return read('sessionStorage', key);
    },
    setSession: function (key, value) {
      write('sessionStorage', key, value);
    },
  };
})();
