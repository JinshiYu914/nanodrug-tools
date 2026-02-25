// LNP配方计算器页面
// 这是我们第一个要开发的核心功能

import React, { useState, useEffect, useMemo } from 'react'
import { Card, Typography, Form, InputNumber, Row, Col, Button, Divider, Alert, Select, Tag, Input, AutoComplete, Tooltip, Modal, message, Steps, Statistic, Space } from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { calculateLnpApi, listExperimentsApi, createExperimentApi, deleteExperimentApi, type LnpCalculateRequest, type LnpExperimentRead, type LnpExperimentCreate } from '@/services/lnp'
import { getUserLnpFormulations, saveUserLnpFormulations } from '@/services/api'
import { applyDerivedValues, computePreparationVolumes, computeStockVolumesFromRatios } from '@/utils/lnp'
import type { LnpForm, PreparationParams, LnpRatios } from '@/types/lnp'
import { useAuthStore } from '@/stores/authStore'

const { Title, Paragraph } = Typography

/**
 * LNP配方计算器组件
 * 
 * 这个页面将包含：
 * 1. 标准配方选择
 * 2. 参数输入表单
 * 3. 实时计算结果
 * 4. 配方保存功能
 */
const LNPCalculator: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const authStatus = useAuthStore(s => s.status)
  const authToken = useAuthStore(s => s.token)
  const currentUser = useAuthStore(s => s.user)
  const [lipidMixes, setLipidMixes] = useState<any[]>([])
  const [savingName, setSavingName] = useState('')
  const [experimentName, setExperimentName] = useState('')
  const [experiments, setExperiments] = useState<LnpExperimentRead[]>([])

  const [form] = Form.useForm()
  const [formVersion, setFormVersion] = useState(0)
  const [hoveredType, setHoveredType] = useState<string | null>(null)
  const defaultTypes: Array<{ key: string, label: string, isStandard: boolean }> = [
    { key: 'ionizable', label: 'Cationic/Ionizable', isStandard: true },
    { key: 'helper', label: 'Structural', isStandard: true },
    { key: 'cholesterol', label: 'Sterol', isStandard: true },
    { key: 'peg', label: 'PEG-Lipid', isStandard: true },
  ]
  const [lipidTypes, setLipidTypes] = useState<Array<{ key: string, label: string, isStandard: boolean }>>(defaultTypes)

  // 登录态感知：加载/清空 我的配方 和 我的实验
  useEffect(() => {
    const loadData = async () => {
      if (authStatus === 'authenticated' && authToken) {
        try {
          const f = await getUserLnpFormulations(authToken)
          setLipidMixes(Array.isArray(f.items) ? f.items : [])
        } catch {}
        try {
          const e = await listExperimentsApi(currentUser?.email)
          setExperiments(e)
        } catch {}
      } else {
        setLipidMixes([])
        setExperiments([])
      }
    }
    loadData()
  }, [authStatus, authToken, currentUser])

  const sortLipidTypes = (list: Array<{ key: string, label: string, isStandard: boolean }>) => {
    const stdOrder = ['ionizable','helper','cholesterol','peg']
    const stdPart = stdOrder
      .filter(k => list.some(t => t.key === k))
      .map(k => list.find(t => t.key === k)!)
    const customPart = list.filter(t => !t.isStandard)
    return [...stdPart, ...customPart]
  }

  // Helper：从当前表单值构造 LnpForm（或从任意 values 对象构造）
  const toNum = (v: any): number => (typeof v === 'number' ? v : Number(v || 0))
  const buildLnpFormFromValues = (values: any): LnpForm => {
    const vol = toNum(values?.lipid_mix_target_volume_ul)
    const unit = values?.volume_unit
    return {
      total_lipid_mg: toNum(values?.total_lipid_mg),
      ratios: {
        ionizable: toNum(values?.r_ionizable),
        helper: toNum(values?.r_helper),
        cholesterol: toNum(values?.r_cholesterol),
        peg: toNum(values?.r_peg),
      },
      molarMass: {
        ionizable: toNum(values?.mm_ionizable),
        helper: toNum(values?.mm_helper),
        cholesterol: toNum(values?.mm_cholesterol),
        peg: toNum(values?.mm_peg),
      },
      stockConc: {
        ionizable: toNum(values?.s_ionizable),
        helper: toNum(values?.s_helper),
        cholesterol: toNum(values?.s_cholesterol),
        peg: toNum(values?.s_peg),
      },
      volumeUnit: unit,
      lipidMixTargetVolume: vol,
      lipidNames: values?.lipids,
    }
  }

  const restoreFormFromExperiment = (exp: LnpExperimentRead) => {
    const f = exp.formulation
    const p = exp.preparation_params || {}
    const lipids = f.lipidNames || {}
    
    const values: any = {
      total_lipid_mg: f.total_lipid_mg,
      lipid_mix_target_volume_ul: f.lipidMixTargetVolume,
      volume_unit: f.volumeUnit,
      
      r_ionizable: f.ratios.ionizable,
      r_helper: f.ratios.helper,
      r_cholesterol: f.ratios.cholesterol,
      r_peg: f.ratios.peg,
      
      mm_ionizable: f.molarMass?.ionizable,
      mm_helper: f.molarMass?.helper,
      mm_cholesterol: f.molarMass?.cholesterol,
      mm_peg: f.molarMass?.peg,
      
      s_ionizable: f.stockConc?.ionizable,
      s_helper: f.stockConc?.helper,
      s_cholesterol: f.stockConc?.cholesterol,
      s_peg: f.stockConc?.peg,
      
      lipids: lipids,
      
      master_conc: p.masterConc_mM,
      frr_aqueous: p.frr_aqueous,
      frr_org: p.frr_org,
      rna_mass: p.rna_mass_ug,
      rna_conc: p.rna_conc_ug_per_uL,
      np_ratio: p.np_ratio,
      amines_per_molecule: p.amines_per_molecule,
    }
    
    // Reconstruct types list
    const keys = Object.keys(lipids)
    const stdMap: Record<string, { key: string, label: string, isStandard: boolean }> = {
      ionizable: defaultTypes[0],
      helper: defaultTypes[1],
      cholesterol: defaultTypes[2],
      peg: defaultTypes[3],
    }
    const stdPart = ['ionizable','helper','cholesterol','peg']
      .filter(k => keys.includes(k))
      .map(k => stdMap[k])
    
    const customKeys = keys.filter(k => !['ionizable','helper','cholesterol','peg'].includes(k))
      .sort((a, b) => Number(a.split('_')[1] || 0) - Number(b.split('_')[1] || 0))
    
    const customPart = customKeys.map((k) => ({ key: k, label: `Custom ${k.split('_')[1] || ''}`.trim(), isStandard: false }))
    
    const list = [...stdPart, ...customPart]
    const nextTypes = list.length > 0 ? sortLipidTypes(list) : defaultTypes
    
    setLipidTypes(nextTypes)
    form.setFieldsValue(values)
    setFormVersion(v => v + 1)
    message.success(`已加载实验：${exp.name}`)
  }

  // 从保存的 values 推断脂质类型列表（用于加载旧配方）
  const deriveTypesFromValues = (values: any): Array<{ key: string, label: string, isStandard: boolean }> => {
    try {
      const lipids = (values || {}).lipids || {}
      const keys = Object.keys(lipids)
      const stdMap: Record<string, { key: string, label: string, isStandard: boolean }> = {
        ionizable: defaultTypes[0],
        helper: defaultTypes[1],
        cholesterol: defaultTypes[2],
        peg: defaultTypes[3],
      }
      const stdPart: Array<{ key: string, label: string, isStandard: boolean }> = ['ionizable','helper','cholesterol','peg']
        .filter(k => keys.includes(k) && String(lipids[k] || '').trim() !== '')
        .map(k => stdMap[k])
      const customKeys = keys.filter(k => k.startsWith('custom_') && String(lipids[k] || '').trim() !== '')
        .sort((a, b) => Number(a.split('_')[1] || 0) - Number(b.split('_')[1] || 0))
      const customPart = customKeys.map((k) => ({ key: k, label: `Custom ${k.split('_')[1] || ''}`.trim(), isStandard: false }))
      const list = [...stdPart, ...customPart]
      return list.length > 0 ? sortLipidTypes(list) : defaultTypes
    } catch {
      return defaultTypes
    }
  }

  const addType = () => {
    const existingKeys = new Set(lipidTypes.map(t => t.key))
    const stdOrder = ['ionizable','helper','cholesterol','peg']
    const missingStd = stdOrder.find(k => !existingKeys.has(k))
    if (missingStd) {
      // 补齐标准四组分优先
      const std = defaultTypes.find(t => t.key === missingStd)!
      setLipidTypes(prev => sortLipidTypes([...prev, std]))
      return
    }
    // 添加自定义类型
    const nextIndex = lipidTypes.filter(t => !t.isStandard).length + 1
    const key = `custom_${nextIndex}`
    setLipidTypes(prev => sortLipidTypes([...prev, { key, label: `Custom ${nextIndex}`, isStandard: false }]))
  }

  const removeType = (key: string) => {
    setLipidTypes(prev => sortLipidTypes(prev.filter(t => t.key !== key)))
    // 清空相关表单字段（避免 const 变量被重新赋值）
    const currentLipids = form.getFieldValue('lipids') || {}
    const patch: any = {
      lipids: { ...currentLipids, [key]: undefined },
    }
    patch[`mm_${key}`] = null
    patch[`r_${key}`] = undefined
    patch[`s_${key}`] = undefined
    patch[`stock_vol_${key}_ul`] = undefined
    form.setFieldsValue(patch)
  }

  // 删除已保存的 lipid mix（右侧列表）
  const removeMix = (idx: number) => {
    const list = lipidMixes.filter((_, i) => i !== idx)
    setLipidMixes(list)
    // Persist only when logged in
    if (authStatus === 'authenticated' && authToken) {
      saveUserLnpFormulations(authToken, list).catch(() => {})
    }
  }

  // 删除已保存的实验（Step 2 右栏列表）
  const removeExperiment = async (id: number) => {
    try {
      if (authStatus === 'authenticated' && authToken) {
        await deleteExperimentApi(id)
        const list = experiments.filter(e => e.id !== id)
        setExperiments(list)
        message.success('实验已删除')
      }
    } catch (e) {
      message.error('删除失败')
    }
  }

  const initialRatios: LnpRatios = {
    ionizable: 50,
    helper: 10,
    cholesterol: 38.5,
    peg: 1.5,
  }

  // 脂质默认选项和分子量数据
  const LIPID_DATABASE = {
    ionizable: {
      'SM-102': { molarWeight: 710.2 },
      'MC3': { molarWeight: 642.1 },
      'ALC-0315': { molarWeight: 766.1 },
    },
    helper: {
      'DSPC': { molarWeight: 790.1 },
      'DOPE': { molarWeight: 744.0 },
      'DOPC': { molarWeight: 786.1 },
    },
    cholesterol: {
      'Cholesterol': { molarWeight: 386.6 },
    },
    peg: {
      'DMG-PEG2000': { molarWeight: 2509.2 },
      'DSPE-PEG2000': { molarWeight: 2805.5 },
      'C14-PEG2000': { molarWeight: 2285.0 },
    },
  } as const

  // 工具函数：判断是否为默认脂质名称
  const isDefaultLipid = (category: keyof typeof LIPID_DATABASE, name?: string): boolean => {
    if (!name) return false
    return Object.prototype.hasOwnProperty.call(LIPID_DATABASE[category], name)
  }

  // 移除本地存储读取，始终使用表单默认值（刷新后重置）

  // 监听 stock solution 变化，保存到 localStorage
  // 保持 Stock 溶液仅由表单状态驱动，不做持久化

  // 移除本地存储写入，刷新后回到默认值

  // Step1 全局记忆：加载与保存（首次打开显示默认 SM-102 配方；若已有记忆则优先记忆）
  // 不从本地存储恢复 Step1，确保登录与游客一致使用默认值

  // 统一通过 formVersion + form.getFieldValue 读取，移除冗余 useWatch

  // 不再写入 Step1 配置到本地存储，刷新后回到默认初始值

  // 监听脂质选择变化，自动填充分子量（使用 formVersion 驱动）
  useEffect(() => {
    const watchedLipids = form.getFieldValue('lipids') || {}
    const updates: any = {}
    // 遍历当前类型，命中默认库则自动填充分子量；自定义类型不自动覆盖；名称为空则清空分子量
    lipidTypes.forEach(t => {
      const name = (watchedLipids as any)[t.key] as string | undefined
      if (name !== undefined) {
        if (t.isStandard) {
          const db = (LIPID_DATABASE as any)[t.key]
          const lipidData = name ? db?.[name] : undefined
          if (lipidData) updates[`mm_${t.key}`] = lipidData.molarWeight
          else if ((name || '').trim() === '') updates[`mm_${t.key}`] = null
        } else {
          if ((name || '').trim() === '') updates[`mm_${t.key}`] = null
        }
      }
    })

    if (Object.keys(updates).length > 0) {
      form.setFieldsValue(updates)
    }
  }, [formVersion, lipidTypes])

  // Molar ratio 总和验证（仅对已定义的当前类型）
  const allValues = form.getFieldsValue()
  const definedCount = lipidTypes.filter(t => !!(allValues?.lipids?.[t.key] && String(allValues.lipids[t.key]).trim() !== '')).length
  const ratioSumDefined = lipidTypes.reduce((acc, t) => {
    const defined = !!(allValues?.lipids?.[t.key] && String(allValues.lipids[t.key]).trim() !== '')
    const rVal = Number(allValues?.[`r_${t.key}`] || 0)
    return acc + (defined ? rVal : 0)
  }, 0)
  const presentTypesCount = lipidTypes.length
  const allNamesEntered = lipidTypes.every(t => !!(allValues?.lipids?.[t.key] && String(allValues.lipids[t.key]).trim() !== ''))
  const allMmEntered = lipidTypes.every(t => {
    const mw = Number(allValues?.[`mm_${t.key}`])
    return typeof mw === 'number' && mw > 0
  })
  const isReadyForWarning = allNamesEntered && allMmEntered
  const needWarn = isReadyForWarning && Math.abs(ratioSumDefined - 100) > 0.01
  let prefix = ''
  if (presentTypesCount >= 1 && presentTypesCount <= 3) {
    prefix = `注意：您选择了 ${presentTypesCount} 个组分脂质，仅这 ${presentTypesCount} 个参与计算。`
  } else if (presentTypesCount > 4) {
    prefix = `注意：您添加了新的脂质类型， 共有${presentTypesCount}种脂质参与计算。`
  }
  const ratioWarning = needWarn ? `${prefix}${prefix ? ' ' : ''}Warning: Sum of molar ratios must equal 100%. Current sum: ${ratioSumDefined.toFixed(1)}%` : null

  // Step2 就绪：不依赖“需要配置体积”，只要已定义类型的名称、分子量、摩尔比与 stock 浓度均已填写
  const stepReadyForStep2 = (() => {
    if (definedCount === 0) return false
    return lipidTypes.every(t => {
      const defined = !!(allValues?.lipids?.[t.key] && String(allValues.lipids[t.key]).trim() !== '')
      if (!defined) return true
      const mm = Number(allValues?.[`mm_${t.key}`] || 0)
      const r = Number(allValues?.[`r_${t.key}`] || 0)
      const s = Number(allValues?.[`s_${t.key}`] || 0)
      return mm > 0 && r > 0 && s > 0
    })
  })()

  // 提交：仅调用后端计算接口，前端不做公式计算
  const onFinish = async (values: any) => {
    setError(null)
    setLoading(true)
    try {
      const formPayload = buildLnpFormFromValues(values)
      const paramsPayload: PreparationParams = {
        masterConc_mM: toNum(values.master_conc),
        frr_aqueous: toNum(values.frr_aqueous),
        frr_org: toNum(values.frr_org),
        rna_mass_ug: toNum(values.rna_mass),
        rna_conc_ug_per_uL: toNum(values.rna_conc),
        np_ratio: toNum(values.np_ratio),
        mm_ionizable: toNum(values.mm_ionizable),
        amines_per_molecule: toNum(values.amines_per_molecule),
      }
      
      const payload: LnpCalculateRequest = {
        form: formPayload,
        params: paramsPayload
      }
      
      const data = await calculateLnpApi(payload)
      setResult(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || '计算失败，请稍后重试')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  // 上方已经定义了 onFinish 本地计算版本

  // 实时计算使用 formVersion + form.getFieldValue 读取当前值
  // 顶层监听：计算后的各脂质 stock 体积 (µL)
  // 移除对各 stock_vol 字段的监听，改为使用 derivedStockVols 作为唯一来源

  
  // 纯函数：根据条目与总目标体积（升）计算各脂质所需体积（升）
  const computeStockVolumes = (
    entries: Array<{ key: string, r: number, mw: number, s: number }>,
    totalVolL: number
  ): Record<string, number> => {
    const C: Record<string, number> = {}
    entries.forEach(e => { C[e.key] = e.s / e.mw })
    const denom = entries.reduce((acc, e) => acc + (e.r / (C[e.key] || 0)), 0)
    if (!denom || denom <= 0) return {}
    const vL: Record<string, number> = {}
    entries.forEach(e => { vL[e.key] = totalVolL * (e.r / (C[e.key] || 1)) / denom })
    return vL
  }

  // Step1 计算需要吸取的 stock 体积（µL）
  // 动态字段将通过 formVersion 触发更新

  // 计算备选：直接基于当前输入派生出体积，避免依赖表单写入
  const derivedStockVols = useMemo(
    (): Record<string, number | undefined> => {
      const toNum = (v: any): number => (typeof v === 'number' ? v : Number(v || 0))
      const defaultObj: Record<string, number | undefined> = {}
      // 严格要求：所有当前类型均已填写名称、分子量、stock浓度与有效比值，且比值和为100
      const entries = lipidTypes.map(t => ({ key: t.key, r: toNum(form.getFieldValue(`r_${t.key}`)), mw: toNum(form.getFieldValue(`mm_${t.key}`)), s: toNum(form.getFieldValue(`s_${t.key}`)), defined: !!(form.getFieldValue('lipids')?.[t.key] && String(form.getFieldValue('lipids')[t.key]).trim() !== '') }))
      const allReady = entries.every(e => e.defined && e.r > 0 && e.mw > 0 && e.s > 0) && Math.abs(ratioSumDefined - 100) <= 0.01
      if (!allReady) return { ...defaultObj }
      const vol = toNum(form.getFieldValue('lipid_mix_target_volume_ul'))
      if (!vol || vol <= 0) return { ...defaultObj }
      const unit = form.getFieldValue('volume_unit')
      const formVals: LnpForm = {
        total_lipid_mg: toNum(form.getFieldValue('total_lipid_mg')),
        ratios: {
          ionizable: toNum(form.getFieldValue('r_ionizable')),
          helper: toNum(form.getFieldValue('r_helper')),
          cholesterol: toNum(form.getFieldValue('r_cholesterol')),
          peg: toNum(form.getFieldValue('r_peg')),
        },
        molarMass: {
          ionizable: toNum(form.getFieldValue('mm_ionizable')),
          helper: toNum(form.getFieldValue('mm_helper')),
          cholesterol: toNum(form.getFieldValue('mm_cholesterol')),
          peg: toNum(form.getFieldValue('mm_peg')),
        },
        stockConc: {
          ionizable: toNum(form.getFieldValue('s_ionizable')),
          helper: toNum(form.getFieldValue('s_helper')),
          cholesterol: toNum(form.getFieldValue('s_cholesterol')),
          peg: toNum(form.getFieldValue('s_peg')),
        },
        volumeUnit: unit,
        lipidMixTargetVolume: vol,
      }
      const vols = computeStockVolumesFromRatios(formVals)
      const toUl = (obj: { uL: number } | undefined) => (obj && typeof obj.uL === 'number' ? Number(obj.uL.toFixed(2)) : undefined)
      const out: Record<string, number | undefined> = {}
      lipidTypes.forEach(t => { out[t.key] = toUl((vols as any)?.[t.key]) })
      return out
    },
    [formVersion, lipidTypes, ratioSumDefined]
  )

  // 统一派生：集中构建 LnpForm 并获取 DerivedValues（包括总脂相浓度）
  const derivedValues = useMemo(() => {
    const toNum = (v: any): number => (typeof v === 'number' ? v : Number(v || 0))
    const vol = toNum(form.getFieldValue('lipid_mix_target_volume_ul'))
    const unit = form.getFieldValue('volume_unit')
    const formVals: LnpForm = {
      total_lipid_mg: toNum(form.getFieldValue('total_lipid_mg')),
      ratios: {
        ionizable: toNum(form.getFieldValue('r_ionizable')),
        helper: toNum(form.getFieldValue('r_helper')),
        cholesterol: toNum(form.getFieldValue('r_cholesterol')),
        peg: toNum(form.getFieldValue('r_peg')),
      },
      molarMass: {
        ionizable: toNum(form.getFieldValue('mm_ionizable')),
        helper: toNum(form.getFieldValue('mm_helper')),
        cholesterol: toNum(form.getFieldValue('mm_cholesterol')),
        peg: toNum(form.getFieldValue('mm_peg')),
      },
      stockConc: {
        ionizable: toNum(form.getFieldValue('s_ionizable')),
        helper: toNum(form.getFieldValue('s_helper')),
        cholesterol: toNum(form.getFieldValue('s_cholesterol')),
        peg: toNum(form.getFieldValue('s_peg')),
      },
      volumeUnit: unit,
      lipidMixTargetVolume: vol,
    }
    return applyDerivedValues(formVals)
  }, [formVersion])

  // 总脂相浓度（M/mM/µM）计算
  const totalLipidConcentration = useMemo(() => {
    try {
      // 新逻辑：不依赖目标总体积，仅根据比例/分子量/stock浓度计算总摩尔浓度
      const toNum = (v: any): number => (typeof v === 'number' ? v : Number(v || 0))
      const rr = lipidTypes.map(t => toNum(form.getFieldValue(`r_${t.key}`)))
      const sumR = rr.reduce((a, b) => a + b, 0)
      if (Math.abs(sumR - 100) > 0.01) return null
      const mms = lipidTypes.map(t => toNum(form.getFieldValue(`mm_${t.key}`)))
      const concs = lipidTypes.map(t => toNum(form.getFieldValue(`s_${t.key}`)))
      if (mms.some(mm => mm <= 0) || concs.some(s => s <= 0)) return null
      const Cs = concs.map((s, i) => s / mms[i]) // mg/mL == g/L，C = (g/L)/(g/mol) = mol/L
      const denom = rr.reduce((acc, r, i) => acc + (r / Cs[i]), 0)
      if (!(denom > 0)) return null
      const M = 100 / denom
      const massConc_g_per_L = lipidTypes.reduce((acc, t, i) => acc + (rr[i] * mms[i]), 0) / denom
      const massConc_mg_per_mL = massConc_g_per_L
      return { M, mM: M * 1e3, uM: M * 1e6, massConc_g_per_L, massConc_mg_per_mL }
    } catch {
      return null
    }
  }, [lipidTypes, formVersion])

  useEffect(() => {
    const toNum = (v: any): number => (typeof v === 'number' ? v : Number(v || 0))
    const vols = computePreparationVolumes(
      {
        total_lipid_mg: Number(form.getFieldValue('total_lipid_mg') || 0),
        ratios: {
          ionizable: Number(form.getFieldValue('r_ionizable') || 0),
          helper: Number(form.getFieldValue('r_helper') || 0),
          cholesterol: Number(form.getFieldValue('r_cholesterol') || 0),
          peg: Number(form.getFieldValue('r_peg') || 0),
        },
        molarMass: {
          ionizable: toNum(form.getFieldValue('mm_ionizable')),
          helper: toNum(form.getFieldValue('mm_helper')),
          cholesterol: toNum(form.getFieldValue('mm_cholesterol')),
          peg: toNum(form.getFieldValue('mm_peg')),
        },
        stockConc: {
          ionizable: toNum(form.getFieldValue('s_ionizable')),
          helper: toNum(form.getFieldValue('s_helper')),
          cholesterol: toNum(form.getFieldValue('s_cholesterol')),
          peg: toNum(form.getFieldValue('s_peg')),
        },
        volumeUnit: (Number(form.getFieldValue('lipid_mix_target_volume_ul')) >= 1000 ? 'mL' : 'uL'),
        lipidMixTargetVolume: Number(form.getFieldValue('lipid_mix_target_volume_ul') || 0),
      },
      {
        masterConc_mM: toNum(form.getFieldValue('master_conc')),
        frr_aqueous: toNum(form.getFieldValue('frr_aqueous')),
        frr_org: toNum(form.getFieldValue('frr_org')),
        rna_mass_ug: toNum(form.getFieldValue('rna_mass')),
        rna_conc_ug_per_uL: toNum(form.getFieldValue('rna_conc')),
        np_ratio: toNum(form.getFieldValue('np_ratio')),
        mm_ionizable: toNum(form.getFieldValue('mm_ionizable')),
        amines_per_molecule: toNum(form.getFieldValue('amines_per_molecule')),
      }
    )
    const patch: any = {}
    if (typeof vols.rna_volume_ul === 'number') patch.rna_volume_ul = vols.rna_volume_ul
    if (typeof vols.cb_buffer_ul === 'number') patch.cb_buffer_ul = vols.cb_buffer_ul
    if (typeof vols.lipid_mix_ul === 'number') patch.lipid_mix_ul = vols.lipid_mix_ul
    if (typeof vols.ethanol_ul === 'number') patch.ethanol_ul = vols.ethanol_ul
    if (Object.keys(patch).length > 0) form.setFieldsValue(patch)
  }, [formVersion, lipidTypes])

  // 移除写回表单的副作用，统一由 derivedStockVols 作为展示唯一来源，减少计算冗余与状态冲突

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Card>
          {(() => {
            const currentStep = stepReadyForStep2 ? 1 : 0
            return (
              <Steps size="small" current={currentStep} style={{ marginBottom: 12 }}
                items={[{ title: '选择配方并配置 Lipid Mix' }, { title: '定义制备参数并查看体积' }]} />
            )
          })()}
          <Paragraph>
            LNP配方计算器(LNP formulate culculator)工具可根据您的脂质配方，快捷地计算实验体系。<br/>
            第一步：选择您的脂质配方并输入需要配置的脂质混合物体积，可自动计算配置方法。<br/>
            第二步：您输入LNP制备的参数（脂相浓度、脂水比，N/P比），以及需要制备的RNA量，则自动计算实验体系。
          </Paragraph>
          <Title level={2}>第一步：选择你的LNP配方，并配置脂质混合物Lipid mix</Title>
        <Divider />

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            lipid_mix_target_volume_ul: undefined,
            r_ionizable: initialRatios.ionizable,
            r_helper: initialRatios.helper,
            r_cholesterol: initialRatios.cholesterol,
            r_peg: initialRatios.peg,
            mm_ionizable: 710.2,
            mm_helper: 790.1,
            mm_cholesterol: 386.6,
            mm_peg: 2509.2,
            s_ionizable: 75,
            s_helper: 10,
            s_cholesterol: 10,
            s_peg: 10,
            frr_aqueous: 3,
            frr_org: 1,
            master_conc: 8,
            np_ratio: 6,
            rna_mass: undefined,
            rna_conc: undefined,
            volume_unit: 'uL',
            lipids: {
              ionizable: 'SM-102',
              helper: 'DSPC',
              cholesterol: 'Cholesterol',
              peg: 'DMG-PEG2000',
            },
            custom_lipids: {
              ionizable: '',
              helper: '',
              cholesterol: '',
              peg: '',
            },
          }}
          onFinish={onFinish}
          onValuesChange={() => setFormVersion(v => v + 1)}
        >
          {/* Step 1：左侧输入，右侧保存与列表 */}
          <Row gutter={16}>
            <Col span={18}>
          {/* 表格布局：左侧为行标题，右侧四列为各脂质 */}
          {(() => {
            const labelSpan = 4
            const cellSpan = Math.max(2, Math.floor((24 - labelSpan) / Math.max(lipidTypes.length, 4)))
            // 每类脂质的默认选项（用于 AutoComplete 的选项），并加入“自定义...”选项
            const autoOptions = (key: string) => {
              const db = (LIPID_DATABASE as any)[key]
              if (!db) return [{ value: 'custom', label: '自定义...' }]
              return [
                ...Object.keys(db).map((name) => ({ value: name, label: name })),
                { value: 'custom', label: '自定义...' },
              ]
            }
            // 统一获取当前脂质名称映射，供渲染使用
            const lipidsValues = form.getFieldValue('lipids') || {}
            return (
              <>
                {/* Row: Type（第一行） */}
                <Row gutter={8} style={{ position: 'relative' }}>
                  <Col span={labelSpan}><Tooltip title="请选择LNP脂质组分"><Typography.Text>Type</Typography.Text></Tooltip></Col>
                  {lipidTypes.map((t) => (
                    <Col key={t.key} span={cellSpan}>
                      <div
                        style={{ position: 'relative', padding: '6px 8px', paddingLeft: hoveredType === t.key ? 22 : 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        onMouseEnter={() => setHoveredType(t.key)}
                        onMouseLeave={() => setHoveredType(null)}
                      >
                        {(() => {
                          const typeHelp: Record<string, string> = {
                            ionizable: '（可电离）阳离子脂质',
                            helper: '辅助脂质（中性脂质）',
                            cholesterol: '胆固醇',
                            peg: 'PEG脂质',
                          }
                          const tip = typeHelp[t.key]
                          return tip ? (
                            <Tooltip title={tip}><span style={{ cursor: 'help' }}>{t.label}</span></Tooltip>
                          ) : (
                            <span>{t.label}</span>
                          )
                        })()}
                        {hoveredType === t.key && (
                          <Tooltip title="删除该类型">
                            <MinusCircleOutlined
                              onClick={() => removeType(t.key)}
                              style={{ position: 'absolute', left: 4, top: 4, color: '#ff4d4f', cursor: 'pointer', fontSize: 14 }}
                            />
                          </Tooltip>
                        )}
                      </div>
                    </Col>
                  ))}
                  <div style={{ position: 'absolute', right: 4, top: 6, zIndex: 2 }}>
                    <Button type="link" size="small" icon={<PlusOutlined />} onClick={addType}>添加类型</Button>
                  </div>
                </Row>
                {/* Row: Lipids（第二行） */}
                <Row gutter={8}>
                  <Col span={labelSpan}><Tooltip title="请选择LNP脂质组分"><Typography.Text strong style={{ cursor: 'help' }}>Lipids</Typography.Text></Tooltip></Col>
                  {lipidTypes.map((t) => (
                    <Col key={t.key} span={cellSpan}>
                      <Form.Item name={["lipids", t.key]}>
                        {(() => {
                          const nameVal = String((lipidsValues as any)?.[t.key] || '')
                          const needEnterLip = nameVal === ''
                          return (
                            <AutoComplete
                              options={autoOptions(t.key)}
                              placeholder={needEnterLip ? '请输入' : '输入或选择脂质'}
                              allowClear
                              style={{ width: '100%', border: needEnterLip ? '1px solid #ff4d4f' : undefined, borderRadius: 4 }}
                              onSelect={(val) => {
                                if (val === 'custom') {
                                  // 切换到自由输入模式：不保存 'custom'，而是清空以便用户输入真实名称
                                  form.setFieldValue(["lipids", t.key], '')
                                  // 清空对应分子量，避免残留上一次默认值
                                  form.setFieldValue(`mm_${t.key}`, null)
                                }
                              }}
                            />
                          )
                        })()}
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
                {/* 删除 N (number) 行 */}
                {/* Row: Molar weight (g/mol) */}
                <Row gutter={8}>
                  <Col span={labelSpan}><Tooltip title="若选择了自定义的lipid，则需要手动输入分子量"><Typography.Text style={{ cursor: 'help' }}>Molar weight (g/mol)</Typography.Text></Tooltip></Col>
                  {lipidTypes.map((t) => (
                    <Col key={t.key} span={cellSpan}>
                      <Form.Item name={`mm_${t.key}`}>
                        {(() => {
                          const name = (lipidsValues as any)[t.key] as string | undefined
                          const isDefault = t.isStandard ? isDefaultLipid(t.key as keyof typeof LIPID_DATABASE, name) : false
                          const mmVal = form.getFieldValue(`mm_${t.key}`)
                          const needEnter = !isDefault && !!(name && name.trim() !== '') && !(typeof mmVal === 'number' && mmVal > 0)
                          return (
                            <InputNumber
                              min={0}
                              style={{ width: '100%' }}
                              disabled={isDefault}
                              status={needEnter ? 'error' : undefined}
                              placeholder={isDefault ? '自动填充' : (needEnter ? '请输入' : '输入分子量')}
                              onFocus={(e) => { const el = e.target as HTMLInputElement; el.select && el.select(); }}
                            />
                          )
                        })()}
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
                {/* Row: Molar ratio (%) */}
                <Row gutter={8}>
                  <Col span={labelSpan}><Tooltip title="LNP各组分摩尔比"><Typography.Text strong style={{ cursor: 'help' }}>Molar ratio (%)</Typography.Text></Tooltip></Col>
                  {lipidTypes.map((t) => (
                    <Col key={t.key} span={cellSpan}>
                      <Form.Item name={`r_${t.key}`}>
                        {(() => {
                          const name = (lipidsValues as any)[t.key] as string | undefined
                          const defined = !!(name && name.trim() !== '')
                          const rVal = form.getFieldValue(`r_${t.key}`)
                          const needEnter = defined && !(typeof rVal === 'number' && rVal > 0)
                          return (
                            <InputNumber
                              min={0}
                              max={100}
                              step={0.1}
                              style={{ width: '100%' }}
                              status={needEnter ? 'error' : undefined}
                              placeholder={needEnter ? '请输入' : undefined}
                              onFocus={(e) => { const el = e.target as HTMLInputElement; el.select && el.select(); }}
                            />
                          )
                        })()}
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
                
                {/* Molar ratio 验证警告 */}
                {ratioWarning && (
                  <Row gutter={8} style={{ marginTop: 8 }}>
                    <Col span={24}>
                      <Alert message={ratioWarning} type="warning" showIcon />
                    </Col>
                  </Row>
                )}
                
                {/* Row: Stock solution (mg/mL) */}
                <Row gutter={8}>
                  <Col span={labelSpan}><Tooltip title="请输入您配置的脂质母液浓度"><Typography.Text style={{ cursor: 'help' }}>Stock solution (mg/mL)</Typography.Text></Tooltip></Col>
                  {lipidTypes.map((t) => (
                    <Col key={t.key} span={cellSpan}>
                      <Form.Item name={`s_${t.key}`}>
                        {(() => {
                          const name = (lipidsValues as any)[t.key] as string | undefined
                          const defined = !!(name && name.trim() !== '')
                          const sVal = form.getFieldValue(`s_${t.key}`)
                          const needEnter = defined && !(typeof sVal === 'number' && sVal > 0)
                          return (
                            <InputNumber
                              min={0}
                              style={{ width: '100%' }}
                              status={needEnter ? 'error' : undefined}
                              placeholder={needEnter ? '请输入' : undefined}
                              onFocus={(e) => { const el = e.target as HTMLInputElement; el.select && el.select(); }}
                            />
                          )
                        })()}
                      </Form.Item>
                    </Col>
                  ))}
                </Row>

                {/* Step 1：需要配置的脂质混合体积（移到此处，位于吸取stock体积之上） */}
                <Row gutter={8} style={{ marginTop: 8 }}>
                  <Col span={8}>
                    <Form.Item name="lipid_mix_target_volume_ul" label={<Tooltip title="配置好的lipid mix可低温保存数天，请根据自己的需要配置"><span style={{ cursor: 'help' }}>需要配置的 lipid mix 体积</span></Tooltip>} style={{ marginBottom: 0 }}>
                      <InputNumber placeholder="输入体积" min={0} style={{ width: '100%' }} onFocus={(e) => { const el = e.target as HTMLInputElement; el.select && el.select(); }} />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item name="volume_unit" label=" " style={{ marginBottom: 0 }}>
                      <Select options={[{ label: 'µL', value: 'uL' }, { label: 'mL', value: 'mL' }]} />
                    </Form.Item>
                  </Col>
                </Row>

                {/* 吸取stock体积显示行：紧跟在 Stock solution 下面 */}
                <Row gutter={8} style={{ marginTop: 16 }}>
                  {(() => {
                    const labelSpan2 = 4
                    const cellSpan2 = Math.max(2, Math.floor((24 - labelSpan2) / Math.max(lipidTypes.length, 4)))
                    return (
                      <>
                        <Col span={labelSpan2}><Typography.Text strong>吸取 stock 体积</Typography.Text></Col>
                        {lipidTypes.map((t) => {
                          const val = derivedStockVols[t.key]
                          let display = '--'
                          if (typeof val === 'number') {
                            if (val >= 1000) {
                              display = `${(val / 1000).toFixed(2)} mL`
                            } else {
                              display = `${val.toFixed(2)} µL`
                            }
                          }
                          return (
                            <Col key={t.key} span={cellSpan2}>
                              <div style={{ 
                                padding: '6px 8px', 
                                border: '1px solid #d9d9d9', 
                                borderRadius: '6px',
                                backgroundColor: '#f5f5f5',
                                textAlign: 'center'
                              }}>
                                {display}
                              </div>
                            </Col>
                          )
                        })}
                      </>
                    )
                  })()}
                </Row>

                {/* 计算成功提醒与总脂相浓度显示 */}
                {(() => {
                  const allReady = lipidTypes.every(t => typeof derivedStockVols[t.key] === 'number')
                  return allReady ? (
                    <Row gutter={8} style={{ marginTop: 8 }}>
                      <Col span={24}>
                        <Alert type="success" showIcon message="请按照如上吸取体积配置脂质混合物。" />
                        {(() => {
                          const total = derivedValues?.totalConcentration || totalLipidConcentration
                          return total ? (
                            <div style={{ marginTop: 8 }}>
                              <Typography.Text>
                                {(() => {
                                  const uM = total.uM
                                  if (uM >= 1000) {
                                    const mM = uM / 1000
                                    return `总的脂相浓度：${mM.toFixed(2)} mM`
                                  }
                                  return `总的脂相浓度：${uM.toFixed(0)} µM`
                                })()}
                              </Typography.Text>
                            </div>
                          ) : null
                        })()}
                      </Col>
                    </Row>
                  ) : null
                })()}
              </>
            )
          })()}

          <Divider />
          {/* Step 1 尾部：体积输入已上移，此处删除 */}
            </Col>
            {/* 右侧：我的配方 */}
            <Col span={6}>
              <div style={{ position: 'sticky', top: 16 }}>
              <Card size="small" title="我的配方">
                <div style={{ display: 'grid', gap: 8 }}>
                  <Input placeholder="请输入配方名字" value={savingName} onChange={(e) => setSavingName(e.target.value)} />
                  <Button onClick={() => {
                    if (authStatus !== 'authenticated') {
                      Modal.info({
                        title: '需要登录',
                        content: '请先登录后再保存配方。',
                      })
                      return
                    }
                    const name = (savingName || '').trim()
                    if (!name) {
                      message.warning('请输入名称')
                      return
                    }
                    const values = form.getFieldsValue()
                    const derived = applyDerivedValues(buildLnpFormFromValues(values))
                    const existingIdx = lipidMixes.findIndex(m => String(m?.name || '') === name)
                    const saveList = (list: any[]) => {
                      setLipidMixes(list)
                      if (authStatus === 'authenticated' && authToken) {
                        saveUserLnpFormulations(authToken, list).catch(() => {})
                      }
                      message.success(`配方已保存：${name}`)
                    }
                    if (existingIdx >= 0) {
                      Modal.confirm({
                        title: '名称重复',
                        content: '已存在相同名称的混合，是否覆盖现有配置？',
                        onOk: () => {
                          const updated = [...lipidMixes]
                          updated[existingIdx] = { name, values, derived, savedAt: Date.now(), types: lipidTypes }
                          saveList(updated)
                        },
                      })
                    } else {
                      const list = [...lipidMixes, { name, values, derived, savedAt: Date.now(), types: lipidTypes }]
                      saveList(list)
                    }
                  }}>保存配方</Button>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <Row gutter={8}>
                  <Col span={24}>
                    {lipidMixes.length === 0 ? (
                      <Typography.Text type="secondary">暂无保存的混合</Typography.Text>
                    ) : (
                      (() => {
                        const pairs = lipidMixes.map((m, i) => ({ mix: m, idx: i }))
                        const sorted = pairs.sort((a, b) => {
                          const ta = Number(a.mix?.savedAt || 0)
                          const tb = Number(b.mix?.savedAt || 0)
                          return tb - ta
                        })
                        return sorted.map(({ mix, idx }) => (
                          <Tag
                            key={`${idx}-${String(mix?.name || '')}`}
                            color="geekblue"
                            closable
                            onClose={(e) => { e.preventDefault(); e.stopPropagation(); removeMix(idx) }}
                            onClick={() => {
                              try {
                                const nextTypes = Array.isArray((mix as any).types) && (mix as any).types.length > 0
                                  ? (mix as any).types
                                  : deriveTypesFromValues(mix.values)
                                setLipidTypes(sortLipidTypes(nextTypes))
                              } catch {}
                              form.setFieldsValue(mix.values)
                              setFormVersion(v => v + 1)
                              message.success(`已加载配方：${mix.name}`)
                            }}
                            style={{ cursor: 'pointer', marginBottom: 8 }}
                          >
                            {mix.name}
                          </Tag>
                        ))
                      })()
                    )}
                  </Col>
                </Row>
              </Card>
              </div>
            </Col>
          </Row>

          {/* Step 2：左 / 中 / 右 三栏布局 */}
          <Divider />
          <Title level={2}>第二步：定义LNP制备参数，开始制备</Title>
          <Row gutter={16}>
            {/* 左栏：三个选项 */}
            <Col span={6}>
              <div style={{ display: 'grid', gap: 12 }}>
                <Typography.Text strong>请输入LNP制备的参数</Typography.Text>

                <Row align="middle" gutter={8}>
                  <Col span={12}><Tooltip title="手包或微流控制备的脂相一般为4-20mM，请参考相关文献"><Typography.Text style={{ cursor: 'help' }}>Lipid Master Mix Conc (mM)</Typography.Text></Tooltip></Col>
                  <Col span={12}>
                    <Form.Item name="master_conc" style={{ marginBottom: 0 }}>
                      {(() => {
                        const v = form.getFieldValue('master_conc')
                        const need = !(typeof v === 'number' && v > 0)
                        const maxAllowed = totalLipidConcentration?.mM || 0
                        const exceed = typeof v === 'number' && maxAllowed > 0 && v > maxAllowed
                        return (
                          <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            precision={2}
                            step={0.01}
                            placeholder="请输入您想配置的脂相终浓度"
                            status={need || exceed ? 'error' : undefined}
                            onChange={(val) => {
                              const num = typeof val === 'number' ? val : Number(val || 0)
                              const currentMax = totalLipidConcentration?.mM || 0
                              if (currentMax > 0 && num > currentMax) {
                                message.warning('浓度需要小于等于配置的lipid mix的浓度')
                                const roundedMax = Number(currentMax.toFixed(2))
                                form.setFieldValue('master_conc', roundedMax)
                              } else {
                                const roundedNum = Number(num.toFixed(2))
                                form.setFieldValue('master_conc', roundedNum)
                              }
                            }}
                          />
                        )
                      })()}
                    </Form.Item>
                  </Col>
                </Row>

                <Row align="middle" gutter={8}>
                  <Col span={12}><Tooltip title="对于经典LNP配方，水相和脂相的比例一般为3：1"><Typography.Text style={{ cursor: 'help' }}>FRR (aqueous : org)</Typography.Text></Tooltip></Col>
                  <Col span={5}>
                    <Form.Item name="frr_aqueous" style={{ marginBottom: 0 }}>
                      {(() => {
                        const v = form.getFieldValue('frr_aqueous')
                        const need = !(typeof v === 'number' && v > 0)
                        return (<InputNumber min={0} style={{ width: '100%' }} status={need ? 'error' : undefined} />)
                      })()}
                    </Form.Item>
                  </Col>
                  <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>:</Col>
                  <Col span={5}>
                    <Form.Item name="frr_org" style={{ marginBottom: 0 }}>
                      {(() => {
                        const v = form.getFieldValue('frr_org')
                        const need = !(typeof v === 'number' && v > 0)
                        return (<InputNumber min={0} style={{ width: '100%' }} status={need ? 'error' : undefined} />)
                      })()}
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={8} style={{ marginTop: 4 }}>
                  {/* 移除 FRR 快速选择控件 */}
                </Row>

                <Row align="middle" gutter={8}>
                  <Col span={12}><Tooltip title="N/P比一般在6-8左右。高N/P比包封率和表达效果一般更好，毒性也会更大。"><Typography.Text style={{ cursor: 'help' }}>N/P Ratio</Typography.Text></Tooltip></Col>
                  <Col span={12}>
                    <Form.Item name="np_ratio" style={{ marginBottom: 0 }}>
                      {(() => {
                        const v = form.getFieldValue('np_ratio')
                        const need = !(typeof v === 'number' && v > 0)
                        return (<InputNumber min={0} style={{ width: '100%' }} status={need ? 'error' : undefined} />)
                      })()}
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={8}>
                  {/* 移除 N/P 快速选择控件 */}
                </Row>

                {(() => {
                  // 当阳离子脂质为自定义名称时，显示伯胺数输入
                  const name = form.getFieldValue(['lipids','ionizable'])
                  const db = (LIPID_DATABASE as any).ionizable || {}
                  const isDefault = !!db[name as string]
                  if (isDefault) return null
                  return (
                    <Row align="middle" gutter={8}>
                      <Col span={12}><Typography.Text>每分子伯胺数</Typography.Text></Col>
                      <Col span={12}>
                        <Form.Item name="amines_per_molecule" style={{ marginBottom: 0 }}>
                          {(() => {
                            const v = form.getFieldValue('amines_per_molecule')
                            const need = !(typeof v === 'number' && v > 0)
                            return (<InputNumber min={1} style={{ width: '100%' }} placeholder="请输入伯胺个数" status={need ? 'error' : undefined} />)
                          })()}
                        </Form.Item>
                      </Col>
                    </Row>
                  )
                })()}
              </div>
            </Col>

            {/* 中栏：上-水相（RNA），下-脂相 */}
            <Col span={12}>
              <div style={{ display: 'grid', gap: 12 }}>
                <Typography.Text strong>请输入需要投入制备LNP的RNA的量</Typography.Text>
                {/* 将 RNA mass 与 RNA conc 移动到 Aqueous 卡片上方 */}
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item label={<Tooltip title="请输入您要制备的RNA量"><span style={{ cursor: 'help' }}>RNA mass (µg)</span></Tooltip>} name="rna_mass">
                      {(() => {
                        const v = form.getFieldValue('rna_mass')
                        const need = !(typeof v === 'number' && v > 0)
                        return (<InputNumber min={0} style={{ width: '100%' }} status={need ? 'error' : undefined} />)
                      })()}
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label={<Tooltip title="您的RNA浓度（建议RNA稀释为1ug/uL储存）"><span style={{ cursor: 'help' }}>RNA conc (µg/µL)</span></Tooltip>} name="rna_conc">
                      {(() => {
                        const v = form.getFieldValue('rna_conc')
                        const need = !(typeof v === 'number' && v > 0)
                        return (<InputNumber min={0} style={{ width: '100%' }} status={need ? 'error' : undefined} />)
                      })()}
                    </Form.Item>
                  </Col>
                </Row>

                {/* 移除空的 Aqueous (RNA) 标题卡片 */}

                {/* 将水相与脂相的体积合并到一个卡片中 */}
                {typeof form.getFieldValue('rna_mass') === 'number' && typeof form.getFieldValue('rna_conc') === 'number' && (
                  <Alert type="success" showIcon message="请按照如下体积配置水相和脂相。" style={{ margin: '8px 0' }} />
                )}
                <Card size="small" title="液体体积（Aqueous & Organic）">
                  <Row gutter={4} style={{ marginBottom: 6 }}>
                    <Col span={24}>
                      <Typography.Text strong style={{ background: '#e6f7ff', padding: '2px 8px', borderRadius: 4 }}>
                        水相
                      </Typography.Text>
                    </Col>
                  </Row>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="RNA volume (µL)" name="rna_volume_ul">
                        <InputNumber disabled style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Citrate buffer (uL)" name="cb_buffer_ul">
                        <InputNumber disabled style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Divider style={{ margin: '8px 0' }} />
                  <Row gutter={4} style={{ marginTop: 12, marginBottom: 6 }}>
                    <Col span={24}>
                      <Typography.Text strong style={{ background: '#fffbe6', padding: '2px 8px', borderRadius: 4 }}>
                        脂相
                      </Typography.Text>
                    </Col>
                  </Row>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label={<Tooltip title="”第一步”配置的脂质混合物"><span style={{ cursor: 'help' }}>Lipid mix (µL)</span></Tooltip>} name="lipid_mix_ul">
                        <InputNumber disabled style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label={<Tooltip title="无水乙醇"><span style={{ cursor: 'help' }}>Ethanol</span></Tooltip>} name="ethanol_ul">
                        <InputNumber disabled style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              </div>
            </Col>

            {/* 右栏：我的实验（保存/调用） */}
            <Col span={6}>
              <div style={{ position: 'sticky', top: 16 }}>
              <Card size="small" title="总览" style={{ marginBottom: 12 }}>
                {(() => {
                  const values = form.getFieldsValue()
                  const fmtVol = (ul?: number): string => {
                    if (typeof ul !== 'number' || Number.isNaN(ul)) return '--'
                    if (ul >= 1000) return `${(ul / 1000).toFixed(2)} mL`
                    return `${ul.toFixed(2)} µL`
                  }
                  const lipidMixUl = values?.lipid_mix_ul
                  const ethanolUl = values?.ethanol_ul
                  const orgTotalUl = (typeof lipidMixUl === 'number' ? lipidMixUl : 0) + (typeof ethanolUl === 'number' ? ethanolUl : 0)
                  const aq = Number(form.getFieldValue('frr_aqueous') || 0)
                  const org = Number(form.getFieldValue('frr_org') || 0)
                  const aqTotalUl = (orgTotalUl > 0 && aq > 0 && org > 0) ? Number((orgTotalUl * (aq / org)).toFixed(2)) : undefined
                  return (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Statistic title="水相总量" value={fmtVol(aqTotalUl)} />
                      <Statistic title="脂相总量" value={fmtVol(orgTotalUl)} />
                    </Space>
                  )
                })()}
              </Card>
              <Card size="small" title="我的实验">
                <div style={{ display: 'grid', gap: 8 }}>
                  <Input placeholder="请输入实验名称" value={experimentName} onChange={(e) => setExperimentName(e.target.value)} />
                  <Button onClick={async () => {
                    if (authStatus !== 'authenticated') {
                      Modal.info({
                        title: '需要登录',
                        content: '请先登录后再保存实验。',
                      })
                      return
                    }
                    const name = (experimentName || '').trim()
                    if (!name) {
                      message.warning('请输入名称')
                      return
                    }
                    
                    const values = form.getFieldsValue()
                    const formPayload = buildLnpFormFromValues(values)
                    const paramsPayload: PreparationParams = {
                        masterConc_mM: toNum(values.master_conc),
                        frr_aqueous: toNum(values.frr_aqueous),
                        frr_org: toNum(values.frr_org),
                        rna_mass_ug: toNum(values.rna_mass),
                        rna_conc_ug_per_uL: toNum(values.rna_conc),
                        np_ratio: toNum(values.np_ratio),
                        mm_ionizable: toNum(values.mm_ionizable),
                        amines_per_molecule: toNum(values.amines_per_molecule),
                    }
                    
                    const payload: LnpExperimentCreate = {
                        name,
                        formulation: formPayload,
                        preparation_params: paramsPayload,
                        user_email: currentUser?.email || '',
                        results: result || undefined
                    }
                    
                    try {
                        await createExperimentApi(payload)
                        message.success(`实验已保存：${name}`)
                        if (currentUser?.email) {
                          const list = await listExperimentsApi(currentUser.email)
                          setExperiments(list)
                        }
                    } catch (e) {
                        message.error('保存失败')
                    }
                  }}>保存实验</Button>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <Row gutter={8}>
                  <Col span={24}>
                    {experiments.length === 0 ? (
                      <Typography.Text type="secondary">暂无保存的实验</Typography.Text>
                    ) : (
                      (() => {
                        const sorted = [...experiments].sort((a, b) => {
                          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                        })
                        return sorted.map((exp) => (
                          <Tag
                            key={exp.id}
                            color="purple"
                            closable
                            onClose={(e) => { e.preventDefault(); e.stopPropagation(); removeExperiment(exp.id) }}
                            onClick={() => restoreFormFromExperiment(exp)}
                            style={{ cursor: 'pointer', marginBottom: 8 }}
                          >
                            {exp.name}
                          </Tag>
                        ))
                      })()
                    )}
                  </Col>
                </Row>
              </Card>
              <Card size="small" title="导出与复制" style={{ marginTop: 12 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <Button onClick={() => {
                    try {
                      const values = form.getFieldsValue()
                      // Helper: 格式化体积（自动 mL/µL）
                      const fmtVol = (ul?: number): string => {
                        if (typeof ul !== 'number' || Number.isNaN(ul)) return '--'
                        if (ul >= 1000) return `${(ul / 1000).toFixed(2)} mL`
                        return `${ul.toFixed(2)} µL`
                      }
                      // 第一部分：Type，Lipids，吸取 stock 体积，总体积
                      const typeLines = lipidTypes.map(t => {
                        const lipName = ((values?.lipids || {})[t.key] || '').toString()
                        const stockUl = derivedStockVols[t.key]
                        return `- ${t.label}: ${lipName || '(未填写)'} | stock ${fmtVol(stockUl)}`
                      }).join('\n')
                      const totalMixVol = Number(values?.lipid_mix_target_volume_ul || 0)
                      const volUnit = String(values?.volume_unit || 'uL')
                      const totalMixLine = `总体积: ${volUnit === 'mL' ? (totalMixVol).toFixed(2) + ' mL' : (totalMixVol).toFixed(2) + ' µL'}`

                      // 第二部分：水相、脂相与总量
                      const rnaVolUl = values?.rna_volume_ul
                      const cbUl = values?.cb_buffer_ul
                      const lipidMixUl = values?.lipid_mix_ul
                      const ethanolUl = values?.ethanol_ul
                      const aqTotalUl = (typeof rnaVolUl === 'number' ? rnaVolUl : 0) + (typeof cbUl === 'number' ? cbUl : 0)
                      const orgTotalUl = (typeof lipidMixUl === 'number' ? lipidMixUl : 0) + (typeof ethanolUl === 'number' ? ethanolUl : 0)
                      const grandTotalUl = aqTotalUl + orgTotalUl
                      const secondPart = [
                        `水相: RNA ${fmtVol(rnaVolUl)} | CB ${fmtVol(cbUl)} | 合计 ${fmtVol(aqTotalUl)}`,
                        `脂相: Lipid mix ${fmtVol(lipidMixUl)} | EtOH ${fmtVol(ethanolUl)} | 合计 ${fmtVol(orgTotalUl)}`,
                        `两相合计总体积: ${fmtVol(grandTotalUl)}`,
                      ].join('\n')

                      const text = [
                        'Step 1 配方与配置',
                        typeLines,
                        totalMixLine,
                        '',
                        'Step 2 制备参数',
                        secondPart,
                      ].join('\n')

                      navigator.clipboard.writeText(text).then(() => {
                        message.success('已复制制备参数到剪贴板')
                      }).catch(() => {
                        message.warning('复制失败，请检查浏览器权限')
                      })
                    } catch (e) {
                      message.error('复制失败')
                    }
                  }}>复制制备参数</Button>
                </div>
              </Card>
              </div>
            </Col>
          </Row>

          {/* Step 2 末尾：移除底部保存入口，统一到右栏 */}
        </Form>

        {error && (
          <Alert type="error" message={error} style={{ marginTop: 12 }} />
        )}

        {result && (
          <Card style={{ marginTop: 16 }} title="计算结果">
            <Row gutter={12}>
              <Col span={6}>
                <Typography.Text strong>Cationic/Ionizable</Typography.Text>
                <div>
                  质量: {result.components?.ionizable?.mass_mg ?? '--'} mg / {result.components?.ionizable?.mass_g ?? '--'} g
                </div>
                <div>
                  摩尔数: {typeof result.components?.ionizable?.moles === 'number' ? result.components.ionizable.moles : '未提供摩尔质量'}
                </div>
              </Col>
              <Col span={6}>
                <Typography.Text strong>Structural</Typography.Text>
                <div>
                  质量: {result.components?.helper?.mass_mg ?? '--'} mg / {result.components?.helper?.mass_g ?? '--'} g
                </div>
                <div>
                  摩尔数: {typeof result.components?.helper?.moles === 'number' ? result.components.helper.moles : '未提供摩尔质量'}
                </div>
              </Col>
              <Col span={6}>
                <Typography.Text strong>Sterol</Typography.Text>
                <div>
                  质量: {result.components?.cholesterol?.mass_mg ?? '--'} mg / {result.components?.cholesterol?.mass_g ?? '--'} g
                </div>
                <div>
                  摩尔数: {typeof result.components?.cholesterol?.moles === 'number' ? result.components.cholesterol.moles : '未提供摩尔质量'}
                </div>
              </Col>
              <Col span={6}>
                <Typography.Text strong>PEG-Lipid</Typography.Text>
                <div>
                  质量: {result.components?.peg?.mass_mg ?? '--'} mg / {result.components?.peg?.mass_g ?? '--'} g
                </div>
                <div>
                  摩尔数: {typeof result.components?.peg?.moles === 'number' ? result.components.peg.moles : '未提供摩尔质量'}
                </div>
              </Col>
            </Row>
          </Card>
        )}
      </Card>
    </div>
  )
}

export default LNPCalculator