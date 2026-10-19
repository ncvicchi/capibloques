import copy
import json
import unittest
from pathlib import Path
from django.core.exceptions import ValidationError
from projects.validation import document

class PondSceneValidationTests(unittest.TestCase):
    def sample(self):
        v=copy.deepcopy(json.loads((Path(__file__).parent/'fixtures/projects-v2.json').read_text(encoding='utf-8'))[0])
        v['simulation']['scene']='pondLab'
        s=v['scene'];s['sourceTemplate']='pondLab'
        s['canvas'].update(width=960,height=540,background='pondLab',pondEnvironment=dict(lagoon=35,reserve=240,evaporation=.05,leak=0,rain=0))
        s['canvas'].pop('itemOrder',None)
        s['devices']=[dict(schemaVersion=1,id='pond-drain',kind='servo',name='Desagüe',position=dict(x=835,y=375),rotation=0,pins=dict(signal=14),config=dict(angle=0))]
        s['widgets']=[]
        return v

    def test_accepts_defaults_and_missing_components(self):
        v=self.sample();self.assertGreater(document(v),0)
        del v['scene']['canvas']['pondEnvironment'];v['scene']['devices']=[]
        self.assertGreater(document(v),0)

    def test_rejects_bad_environment(self):
        for key,bad in [('lagoon',101),('reserve',301),('rain',5),('leak',-1),('evaporation',True),('extra',0)]:
            v=self.sample();v['scene']['canvas']['pondEnvironment'][key]=bad
            with self.assertRaises(ValidationError):document(v)

    def test_rejects_geometry_and_duplicate(self):
        for key in ['size','position','duplicate','rotation']:
            v=self.sample();s=v['scene']
            if key=='size':s['canvas']['width']=900
            elif key=='position':s['devices'][0]['position']['x']=700
            elif key=='rotation':s['devices'][0]['rotation']=90
            else:
                other=copy.deepcopy(s['devices'][0]);other['id']='second-drain';other['pins']['signal']=None;s['devices'].append(other)
            with self.assertRaises(ValidationError):document(v)
