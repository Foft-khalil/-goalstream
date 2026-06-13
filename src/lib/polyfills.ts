// Polyfills for iOS 12.5.8 (Safari 12) compatibility
// These are additional polyfills that supplement the inline script in layout.tsx
// All checks are guarded for SSR compatibility

// Object.fromEntries - Safari 12.1+
if (typeof Object.fromEntries !== 'function') {
  Object.fromEntries = function iter(entries: IterableIterator<[string, any]> | Array<[string, any]>) {
    const obj: Record<string, any> = {};
    if (Array.isArray(entries)) {
      for (let i = 0; i < entries.length; i++) {
        obj[entries[i][0]] = entries[i][1];
      }
    } else {
      for (const [key, value] of entries) {
        obj[key] = value;
      }
    }
    return obj;
  };
}

// Only run browser-specific polyfills on the client
if (typeof window !== 'undefined') {
  // globalThis - Safari 12.1+
  if (typeof globalThis === 'undefined') {
    (function() {
      const global = this || window || Function('return this')();
      (window as any).globalThis = global;
    })();
  }

  // Promise.allSettled - Safari 13+
  if (typeof Promise.allSettled !== 'function') {
    Promise.allSettled = function<T>(promises: Array<Promise<T>>) {
      return Promise.all(
        promises.map(function(promise) {
          return Promise.resolve(promise).then(
            function(value) { return { status: 'fulfilled', value: value }; },
            function(reason) { return { status: 'rejected', reason: reason }; }
          );
        })
      );
    } as any;
  }

  // String.prototype.replaceAll - Safari 13.1+
  if (typeof String.prototype.replaceAll !== 'function') {
    String.prototype.replaceAll = function(str: string, newStr: string) {
      if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') {
        return this.replace(str as any, newStr);
      }
      return this.split(str).join(newStr);
    };
  }

  // Array.prototype.flat - Safari 12+ (should be supported, but just in case)
  if (typeof Array.prototype.flat !== 'function') {
    Array.prototype.flat = function(depth?: number) {
      const d = depth === undefined ? 1 : Math.floor(depth);
      if (d < 1) return Array.prototype.slice.call(this);
      let result: any[] = [];
      for (let i = 0; i < this.length; i++) {
        if (i in this) {
          const val = this[i];
          if (Array.isArray(val) && d > 0) {
            result = result.concat(val.flat(d - 1));
          } else {
            result.push(val);
          }
        }
      }
      return result;
    };
  }

  // Array.prototype.flatMap - Safari 12+ (should be supported, but just in case)
  if (typeof Array.prototype.flatMap !== 'function') {
    Array.prototype.flatMap = function(callback: any, thisArg: any) {
      return this.map(callback, thisArg).flat(1);
    };
  }

  // Array.prototype.at - Safari 15.4+
  if (typeof Array.prototype.at !== 'function') {
    Array.prototype.at = function(index: number) {
      const len = this.length;
      const i = index >= 0 ? index : len + index;
      return i >= 0 && i < len ? this[i] : undefined;
    };
  }

  // Object.hasOwn - Safari 15.4+
  if (typeof Object.hasOwn !== 'function') {
    Object.hasOwn = function(obj: object, prop: string) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    };
  }

  // Node.prototype.forEach for NodeList - some older Safari need this
  if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach as any;
  }

  // IntersectionObserver - Safari 12.1+ (critical for infinite scroll)
  // Double-check window to avoid SSR issues
  if (typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined') {
    (window as any).IntersectionObserver = function IntersectionObserver(callback: any, options: any) {
      this.callback = callback;
      this.elements = [];
      this.observe = function(el: Element) {
        this.elements.push(el);
        callback([{ isIntersecting: true, target: el }], this);
      };
      this.unobserve = function() {};
      this.disconnect = function() { this.elements = []; };
    };
  }
}
