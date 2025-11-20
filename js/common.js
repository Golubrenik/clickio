const silence = false;
const debug = (message, data = null) => {
  if (silence) return;

  if (data !== null) {
    console.log(message, data);
  } else {
    console.log(message);
  }
};

const _get = (obj, key, def, undef) => {
  let target = Object.assign({}, obj);
  const path = key.split ? key.split(".") : key;
  for (let p = 0; p < path.length; p++) {
    target = target ? target[path[p]] : undef;
  }
  return target === undef ? def : target;
};

class Configurator {
  constructor(configuration) {
    this.configuration = configuration;
  }

  get(key, def) {
    return _get(this.configuration, key, def);
  }

  fontColor(key, defaultColor) {
    return this._color(key, defaultColor, "font");
  }

  backgroundColor(key, defaultColor) {
    return this._color(key, defaultColor, "background");
  }

  elementsColor(key, defaultColor) {
    return this._color(key, defaultColor, "elements");
  }

  _color(key, defaultColor, brandDefault) {
    if (defaultColor) {
      return this._colorOrDefault(key, defaultColor);
    }

    return this._colorOrBrandDefault(key, brandDefault);
  }

  _colorOrDefault(key, defaultColor) {
    return this.get(key) || defaultColor;
  }

  _colorOrBrandDefault(key, defaultKey) {
    return this.get(key) || this.get(`brand.${defaultKey}.color`);
  }
}

function flattenIter(output, nullish, sep, val, key) {
  let k,
    pfx = key ? key + sep : key;

  if (val == null) {
    if (nullish) output[key] = val;
  } else if (typeof val !== "object") {
    output[key] = val;
  } else {
    for (k in val) {
      flattenIter(output, nullish, sep, val[k], pfx + k);
    }
  }
}

function flatten(input, glue = ".", toNull = true) {
  const output = {};
  if (typeof input === "object") {
    flattenIter(output, Boolean(toNull), glue, input, "");
  }
  return output;
}

function emptyKey(key) {
  return !Number.isNaN(key) ? [] : {};
}

function unflatten(input, glue = ".") {
  let arr, tmp, output;
  let i = 0,
    k,
    key;

  for (k in input) {
    tmp = output; // reset
    arr = k.split(glue);

    for (i = 0; i < arr.length; ) {
      key = arr[i++];

      if (tmp == null) {
        tmp = emptyKey(+key);
        output = output || tmp;
      }

      if (["__proto__", "constructor", "prototype"].includes(key)) {
        break;
      }

      if (i < arr.length) {
        if (key in tmp) {
          tmp = tmp[key];
        } else {
          tmp = tmp[key] = emptyKey(+arr[i]);
        }
      } else {
        tmp[key] = input[k];
      }
    }
  }

  return output;
}
