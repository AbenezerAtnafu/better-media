/** @type {import('jest').Config} */
module.exports = {
  ...require("../../../jest.config.base.cjs"),
  moduleNameMapper: {
    "^file-type$": "<rootDir>/src/__mocks__/file-type.ts",
    "^image-size$": "<rootDir>/src/__mocks__/image-size.ts",
  },
};
