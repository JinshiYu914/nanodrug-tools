from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, confloat

# 定义数据模型，对应前端的 TypeScript 接口

class LnpRatios(BaseModel):
    ionizable: float
    helper: float
    cholesterol: float
    peg: float

class LnpMolarMass(BaseModel):
    ionizable: Optional[float] = None
    helper: Optional[float] = None
    cholesterol: Optional[float] = None
    peg: Optional[float] = None

class StockConc(BaseModel):
    ionizable: Optional[float] = None
    helper: Optional[float] = None
    cholesterol: Optional[float] = None
    peg: Optional[float] = None

class LnpForm(BaseModel):
    total_lipid_mg: float
    ratios: LnpRatios
    molarMass: Optional[LnpMolarMass] = None
    stockConc: Optional[StockConc] = None
    lipidMixTargetVolume: Optional[float] = None
    volumeUnit: Optional[str] = "uL"
    lipidNames: Optional[Dict[str, str]] = None # Added to store lipid names (e.g. SM-102)

class PreparationParams(BaseModel):
    masterConc_mM: Optional[float] = None
    frr_aqueous: Optional[float] = None
    frr_org: Optional[float] = None
    rna_mass_ug: Optional[float] = None
    rna_conc_ug_per_uL: Optional[float] = None
    np_ratio: Optional[float] = None
    mm_ionizable: Optional[float] = None
    amines_per_molecule: Optional[float] = None

class PreparationVolumes(BaseModel):
    rna_volume_ul: Optional[float] = None
    cb_buffer_ul: Optional[float] = None
    lipid_mix_ul: Optional[float] = None
    ethanol_ul: Optional[float] = None
    aqueous_total_ul: Optional[float] = None
    organic_total_ul: Optional[float] = None

class DerivedComponents(BaseModel):
    ionizable: Dict[str, Any]
    helper: Dict[str, Any]
    cholesterol: Dict[str, Any]
    peg: Dict[str, Any]

class TotalConcentration(BaseModel):
    M: float
    mM: float
    uM: float
    massConc_mg_per_mL: float

class DerivedValues(BaseModel):
    total_lipid_mg: float
    ratios: LnpRatios
    components: DerivedComponents
    stockVolumes: Optional[Dict[str, Any]] = None
    totalConcentration: Optional[TotalConcentration] = None


def round_to(value: float, digits: int) -> float:
    factor = pow(10, digits)
    return round(value * factor) / factor


def compute_stock_volumes_from_ratios(form: LnpForm) -> Optional[Dict[str, Any]]:
    ratios = form.ratios
    mm = form.molarMass or LnpMolarMass()
    s = form.stockConc or StockConc()
    unit = form.volumeUnit or 'uL'
    vol = form.lipidMixTargetVolume or 0

    # 校验：必须提供四项的名称不由此函数处理，但需保证r/mm/s均为正且比例和为100
    total_ratio = ratios.ionizable + ratios.helper + ratios.cholesterol + ratios.peg
    if not (vol > 0) or abs(total_ratio - 100) > 0.01:
        return None

    def to_positive(v: Optional[float]) -> Optional[float]:
        return v if v is not None and v > 0 else None

    rr = {
        'ionizable': to_positive(ratios.ionizable),
        'helper': to_positive(ratios.helper),
        'cholesterol': to_positive(ratios.cholesterol),
        'peg': to_positive(ratios.peg),
    }
    mms = {
        'ionizable': to_positive(mm.ionizable),
        'helper': to_positive(mm.helper),
        'cholesterol': to_positive(mm.cholesterol),
        'peg': to_positive(mm.peg),
    }
    conc = {
        'ionizable': to_positive(s.ionizable),
        'helper': to_positive(s.helper),
        'cholesterol': to_positive(s.cholesterol),
        'peg': to_positive(s.peg),
    }

    # 若任何所需值缺失则返回None
    for k in ['ionizable', 'helper', 'cholesterol', 'peg']:
        if rr[k] is None or mms[k] is None or conc[k] is None:
            return None

    # mg/mL == g/L；C = (g/L) / (g/mol) = mol/L
    C = {
        'ionizable': conc['ionizable'] / mms['ionizable'],
        'helper': conc['helper'] / mms['helper'],
        'cholesterol': conc['cholesterol'] / mms['cholesterol'],
        'peg': conc['peg'] / mms['peg'],
    }

    denom = (rr['ionizable'] / C['ionizable'] + 
             rr['helper'] / C['helper'] + 
             rr['cholesterol'] / C['cholesterol'] + 
             rr['peg'] / C['peg'])
    
    if not (denom > 0):
        return None

    volL = vol * 1e-3 if unit == 'mL' else vol * 1e-6
    vL = {
        'ionizable': volL * (rr['ionizable'] / C['ionizable']) / denom,
        'helper': volL * (rr['helper'] / C['helper']) / denom,
        'cholesterol': volL * (rr['cholesterol'] / C['cholesterol']) / denom,
        'peg': volL * (rr['peg'] / C['peg']) / denom,
    }

    def to_out(liters: float) -> Dict[str, float]:
        return {'mL': round_to(liters * 1e3, 6), 'uL': round_to(liters * 1e6, 2)}

    return {
        'ionizable': to_out(vL['ionizable']),
        'helper': to_out(vL['helper']),
        'cholesterol': to_out(vL['cholesterol']),
        'peg': to_out(vL['peg']),
    }


def compute_total_concentration(form: LnpForm) -> Optional[TotalConcentration]:
    vols = compute_stock_volumes_from_ratios(form)
    unit = form.volumeUnit or 'uL'
    vol = form.lipidMixTargetVolume or 0
    volL = vol * 1e-3 if unit == 'mL' else vol * 1e-6
    
    if not vols or not (volL > 0):
        return None

    mm = form.molarMass or LnpMolarMass()
    s = form.stockConc or StockConc()
    
    moles_total = 0
    mass_total_g = 0
    keys = ['ionizable', 'helper', 'cholesterol', 'peg']
    
    for k in keys:
        mmk = getattr(mm, k)
        sk = getattr(s, k)
        vuk = vols[k]['uL']
        
        if not (isinstance(mmk, (int, float)) and mmk > 0):
            return None
        if not (isinstance(sk, (int, float)) and sk > 0):
            return None
        if not (isinstance(vuk, (int, float)) and vuk > 0):
            return None
            
        V_Li = vuk * 1e-6
        mass_g = sk * V_Li  # mg/mL == g/L
        moles = mass_g / mmk
        moles_total += moles
        mass_total_g += mass_g
        
    M = moles_total / volL
    massConc_g_per_L = mass_total_g / volL
    massConc_mg_per_mL = massConc_g_per_L
    
    return TotalConcentration(
        M=M,
        mM=M * 1e3,
        uM=M * 1e6,
        massConc_mg_per_mL=massConc_mg_per_mL
    )


def compute_preparation_volumes(form: LnpForm, params: PreparationParams) -> PreparationVolumes:
    def to_num(v: Any) -> float:
        return float(v) if v is not None else 0.0

    conc = to_num(params.rna_conc_ug_per_uL)
    mass = to_num(params.rna_mass_ug)
    rnaVolUl = mass / conc if conc > 0 else None
    
    aq = to_num(params.frr_aqueous)
    org = to_num(params.frr_org)
    
    cbBufferUl = None
    lipidMixUl = None
    ethanolUl = None
    aqueousTotalUl = None
    organicTotalUl = None
    
    try:
        sumFRR = aq + org
        if sumFRR > 0:
            np = to_num(params.np_ratio)
            # mmIon = to_num(params.mm_ionizable) # Unused in TS code?
            aminesRaw = to_num(params.amines_per_molecule)
            amines = aminesRaw if aminesRaw > 0 else 1
            
            mass_g = to_num(params.rna_mass_ug) / 1e6
            mol_P = mass_g / 330 if mass_g > 0 else 0
            mol_N_required = np * mol_P if np > 0 and mol_P > 0 else 0
            mol_ionizable_required = mol_N_required / amines if amines > 0 and mol_N_required > 0 else 0
            
            totalConc = compute_total_concentration(form)
            c_total_source_M = totalConc.M if totalConc and totalConc.M > 0 else 0
            
            rIon = max(to_num(form.ratios.ionizable), 0) / 100
            c_ion_source_M = c_total_source_M * rIon if c_total_source_M > 0 and rIon > 0 else 0
            
            vol_lipidmix_L = mol_ionizable_required / c_ion_source_M if c_ion_source_M > 0 and mol_ionizable_required > 0 else 0
            lipidMixUl = float(f"{vol_lipidmix_L * 1e6:.2f}") if vol_lipidmix_L > 0 else None
            
            c_target_M = params.masterConc_mM * 1e-3 if params.masterConc_mM and params.masterConc_mM > 0 else 0
            
            if c_target_M > 0 and c_total_source_M > 0 and vol_lipidmix_L > 0:
                vol_org_L = (c_total_source_M / c_target_M) * vol_lipidmix_L
                organicTotalUl = float(f"{vol_org_L * 1e6:.2f}")
                
                if lipidMixUl is not None and organicTotalUl > 0:
                    ethanolUl = max(organicTotalUl - lipidMixUl, 0)
                
                if organicTotalUl > 0:
                    aqueousTotalUl = float(f"{organicTotalUl * (aq / org):.2f}")
                    
    except Exception:
        pass

    if aqueousTotalUl is not None:
        if rnaVolUl is not None:
            cbBufferUl = max(aqueousTotalUl - rnaVolUl, 0)
        else:
            cbBufferUl = aqueousTotalUl

    out = PreparationVolumes()
    if rnaVolUl is not None and rnaVolUl == rnaVolUl: # check NaN
        out.rna_volume_ul = float(f"{rnaVolUl:.2f}")
    if cbBufferUl is not None and cbBufferUl == cbBufferUl:
        out.cb_buffer_ul = float(f"{cbBufferUl:.2f}")
    if lipidMixUl is not None and lipidMixUl == lipidMixUl:
        out.lipid_mix_ul = lipidMixUl
    if ethanolUl is not None and ethanolUl == ethanolUl:
        out.ethanol_ul = ethanolUl
    if aqueousTotalUl is not None and aqueousTotalUl == aqueousTotalUl:
        out.aqueous_total_ul = aqueousTotalUl
    if organicTotalUl is not None and organicTotalUl == organicTotalUl:
        out.organic_total_ul = organicTotalUl
        
    return out
