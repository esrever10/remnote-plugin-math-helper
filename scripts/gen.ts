import * as fs from 'fs';
import * as R from 'remeda';

const main = () => {
  const readFileLines = (filename: string) =>
    fs.readFileSync(filename).toString('utf8').split('\n');
  const rulsFileName = 'public/rules';
  const genFileName = 'src/lib/rules.ts';
  const lines = readFileLines(rulsFileName);
  fs.writeFileSync(
    genFileName,
    `import * as Re from "remeda"
const symbolRulesList: string[] =
[
`
  );
  const linesStr = R.pipe(
    lines,
    R.map((x) => `  "${x.trimEnd().replace(/\\/g, '\\\\').replace(/\"/g, '\\"')}",\n`),
    R.reduce((acc, x) => acc + x, '')
  );

  fs.appendFileSync(genFileName, linesStr);

  fs.appendFileSync(
    genFileName,
    `]

export const symbolRules = Re.fromPairs(
  Re.map(symbolRulesList, (x) => {
    const [key, ...values] = x.split("::");
    return [key, values.join("::")] as [string, string];
  })
);
`
  );
};

main();
