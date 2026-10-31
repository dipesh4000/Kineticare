"""Prepare bounded source context for Gemini, or validate its JSON response locally."""
import argparse
import json
import sys
from pathlib import Path

from knowledge_base import ROOT, build_indexes, prepare_context, read, validate_plan


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('query',nargs='?')
    parser.add_argument('--reindex',action='store_true')
    parser.add_argument('--limit',type=int,default=12)
    parser.add_argument('--output',type=Path)
    parser.add_argument('--validate-plan',type=Path)
    args=parser.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')
    if args.reindex:
        build_indexes()
    if not args.query:
        if args.reindex:
            print('Indexes rebuilt.')
            return
        parser.error('A query is required.')
    context=prepare_context(args.query,args.limit)
    result=validate_plan(json.loads(args.validate_plan.read_text(encoding='utf-8')),context) if args.validate_plan else {
        'system_instruction':(ROOT/'generation/gemini-system-instructions.md').read_text(encoding='utf-8'),
        'context':context,'response_schema':read('schemas/generation-plan.schema.json')}
    output=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.output:
        target=args.output.resolve()
        if not target.is_relative_to(ROOT.parent.resolve()) or target.suffix!='.json' or target.exists():
            parser.error('Output must be a new .json file inside this workspace.')
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(output,encoding='utf-8')
        print(f'Wrote {target}')
    else:
        print(output)


if __name__=='__main__':
    main()
