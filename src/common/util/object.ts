export const pick = (object, allowedKeys) => {
  //Iterates over the allowed keys only, much more effictive
  return allowedKeys.reduce((obj, key) => {
    if (object && Object.prototype.hasOwnProperty.call(object, key)) {
      if (object[key] !== 'undefined') {
        obj[key] = object[key];
      }
    }
    return obj;
  }, {});
};

export function removeKeys(
  obj: Record<string, any>,
  keysToRemove: string[],
): Record<string, any> {
  const newObj: Record<string, any> = { ...obj }; // Create a shallow copy of the original object

  keysToRemove.forEach((key) => {
    if (newObj.hasOwnProperty(key)) {
      delete newObj[key]; // Remove the key if it exists in the object
    }
  });

  return newObj;
}

export function pickKeys(
  obj: Record<string, any>,
  keysToKeep: string[],
): Record<string, any> {
  const newObj: Record<string, any> = {};

  keysToKeep.forEach((key) => {
    if (obj.hasOwnProperty(key)) {
      newObj[key] = obj[key];
    }
  });

  return newObj;
}
