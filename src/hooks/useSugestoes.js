import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'

export function useSugestoes(usuario) {
  const [sugestoes, setSugestoes] = useState([])

  useEffect(() => {
    const ref = collection(db, 'sugestoes')
    const unsub = onSnapshot(ref, (snap) => {
      setSugestoes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const pendentes = sugestoes.filter(s => s.status === 'pendente')

  const aprovar = async (sugestao) => {
    await addDoc(collection(db, 'catalogo'), {
      nome: sugestao.nome,
      categoria: sugestao.categoria,
      subcategoria: sugestao.subcategoria || '',
      grupoSubstituicao: sugestao.grupoSubstituicao || [],
      historico: [],
      receitas: [],
      criadoEm: serverTimestamp(),
    })
    await updateDoc(doc(db, 'sugestoes', sugestao.id), {
      status: 'aprovado',
      aprovadores: [usuario.uid],
      aprovadoEm: serverTimestamp(),
    })
  }

  const rejeitar = async (sugestao) => {
    await updateDoc(doc(db, 'sugestoes', sugestao.id), {
      status: 'rejeitado',
      rejeitadoPor: usuario.email,
      rejeitadoEm: serverTimestamp(),
    })
  }

  const atualizar = async (sugestao, dados) => {
    await updateDoc(doc(db, 'sugestoes', sugestao.id), dados)
  }

  const deletar = async (sugestao) => {
    await deleteDoc(doc(db, 'sugestoes', sugestao.id))
  }

  return { sugestoes, pendentes, aprovar, rejeitar, atualizar, deletar }
}