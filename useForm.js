/**
 * useForm Hook
 * 
 * Manages form state, validation, and submission
 * 
 * Usage:
 * const { values, errors, setFieldValue, handleSubmit } = useForm(
 *   { name: '', email: '' },
 *   onSubmit,
 *   { email: (val) => val.includes('@') }
 * )
 */

import { useState, useCallback } from 'react'

export const useForm = (initialValues, onSubmit, validators = {}) => {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [loading, setLoading] = useState(false)

  const validate = useCallback((name, value) => {
    if (validators[name]) {
      const validator = validators[name]
      if (typeof validator === 'function') {
        const isValid = validator(value)
        return isValid ? null : `Invalid ${name}`
      }
    }
    return null
  }, [validators])

  const setFieldValue = useCallback((name, value) => {
    setValues(prev => ({
      ...prev,
      [name]: value
    }))

    // Validate on change
    const error = validate(name, value)
    if (error) {
      setErrors(prev => ({
        ...prev,
        [name]: error
      }))
    } else {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }, [validate])

  const setFieldTouched = useCallback((name) => {
    setTouched(prev => ({
      ...prev,
      [name]: true
    }))
  }, [])

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    setFieldValue(name, type === 'checkbox' ? checked : value)
  }, [setFieldValue])

  const handleBlur = useCallback((e) => {
    const { name } = e.target
    setFieldTouched(name)
  }, [setFieldTouched])

  const validateAll = useCallback(() => {
    const newErrors = {}
    Object.keys(values).forEach(name => {
      const error = validate(name, values[name])
      if (error) newErrors[name] = error
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [values, validate])

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.()
    
    if (!validateAll()) {
      return
    }

    setLoading(true)
    try {
      await onSubmit(values)
    } catch (error) {
      console.error('Form submission error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [values, onSubmit, validateAll])

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  return {
    values,
    errors,
    touched,
    loading,
    setFieldValue,
    setFieldTouched,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    isValid: Object.keys(errors).length === 0
  }
}

export default useForm
