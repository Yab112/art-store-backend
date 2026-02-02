import slugify from "slugify";

export const generateSlug = (title: string, random = true) => {
  const baseSlug = slugify(title, { lower: true });
  const first10 = baseSlug.slice(0, 10);
  const timestamp = Date.now().toString();
  let randomPart = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  if (!random) randomPart = "";
  return `${first10}-${timestamp}-${randomPart}`;
};

export const removeSubArr = (mainArr: string[], arrToBeRemoved: string[]) => {
  return mainArr.filter((name) => {
    return !arrToBeRemoved.includes(name);
  });
};

/**
 * a function to generate a random string of length len
 * @param len
 */
export function generateRandom(len: number) {
  let pass = "";
  const str =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ" + "abcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 1; i <= len; i++) {
    const char = Math.floor(Math.random() * str.length + 1);
    pass += str.charAt(char);
  }
  return pass;
}
