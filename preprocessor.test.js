const fs = require('fs');
const path = require('path');
const pegjs = require('pegjs');
const util = require('util');

const generate = (ast) =>
  typeof ast === 'string'
    ? ast
    : !ast
    ? ''
    : Array.isArray(ast)
    ? ast.map(generate).join('')
    : ast.type in generators
    ? generators[ast.type](ast)
    : `NO GENERATOR FOR ${ast.type}` + util.inspect(ast, false, null, true);

const generators = {
  program: (node) =>
    generate(node.wsStart) + generate(node.blocks) + generate(node.wsEnd),
  text: (node) => generate(node.text),
  literal: (node) => generate(node.literal) + generate(node.whitespace),
  identifier: (node) => generate(node.identifier) + generate(node.whitespace),

  binary: (node) =>
    generate(node.left) + generate(node.operator) + generate(node.right),
  group: (node) =>
    generate(node.lp) + generate(node.expression) + generate(node.rp),
  unary: (node) => generate(node.operator) + generate(node.expression),
  int_constant: (node) => generate(node.token) + generate(node.whitespace),

  define: (node) =>
    generate(node.wsStart) +
    generate(node.define) +
    generate(node.identifier) +
    generate(node.definition) +
    generate(node.wsEnd),
  define_arguments: (node) =>
    generate(node.wsStart) +
    generate(node.define) +
    generate(node.identifier) +
    generate(node.lp) +
    generate(node.args) +
    generate(node.rp) +
    generate(node.definition) +
    generate(node.wsEnd),
  conditional: (node) =>
    generate(node.wsStart) +
    generate(node.ifPart) +
    generate(node.body) +
    generate(node.elseIfParts) +
    generate(node.elsePart) +
    generate(node.endif) +
    generate(node.wsEnd),
};

const file = (filePath) => fs.readFileSync(path.join('.', filePath)).toString();

const grammar = file('peg/preprocessor.pegjs');
const testFile = file('glsltest.glsl');
const parser = pegjs.generate(grammar, { cache: true });

const middle = /\/\* start \*\/((.|[\r\n])+)(\/\* end \*\/)?/m;

const debugProgram = (program) => {
  const ast = parser.parse(program);
  console.log(util.inspect(ast, false, null, true));
};

const debugStatement = (stmt) => {
  const program = `void main() {/* start */${stmt}/* end */}`;
  const ast = parser.parse(program);
  console.log(
    util.inspect(ast.program[0].body.statements[0], false, null, true)
  );
};

const expectParsedStatement = (stmt) => {
  const program = `void main() {/* start */${stmt}/* end */}`;
  const ast = parser.parse(program);
  const glsl = generate(ast);
  if (glsl !== program) {
    console.log(util.inspect(ast.program[0], false, null, true));
    expect(glsl.match(middle)[1]).toBe(stmt);
  }
};

const parseStatement = (stmt) => {
  const program = `void main() {${stmt}}`;
  return parser.parse(program);
};

const expectParsedProgram = (sourceGlsl) => {
  const ast = parser.parse(sourceGlsl);
  const glsl = generate(ast);
  if (glsl !== sourceGlsl) {
    console.log(util.inspect(ast, false, null, true));
    expect(glsl).toBe(sourceGlsl);
  }
};

test('preprocessor test', () => {
  expectParsedProgram(`
  #define MIN(a,b) (((a)<(b)) ? a : b)
#if A == 1
 #define A
#endif`);
});

test('preprocessor test', () => {
  expectParsedProgram(`
  #define MIN(a,b) (((a)<(b)) ? a : b)
#if A == 1
  #define A
#elif A == 1 || defined(B)
#endif
#define A B laskdjflasdkfjasf
    float a;
    vloat b;
  `);
});
