// Problema de decisão completo (estrutura compartilhada por templates,
// persistência e import/export). Espelha o payload de /api/solve, mais um
// nome opcional e escalas qualitativas por critério.

import type { CriterionInput } from "@/lib/api";

export interface Problem {
  name: string;
  alternatives: string[];
  criteria: CriterionInput[];
  matrix: number[][];
}

// Problema em branco: o mínimo válido para o PROMETHEE (2 alternativas,
// 1 critério). Ponto de partida para "começar do zero".
export function blankProblem(): Problem {
  return {
    name: "Novo problema",
    alternatives: ["Alternativa 1", "Alternativa 2"],
    criteria: [{ name: "Critério 1", weight: 1, maximize: true, preference: "usual" }],
    matrix: [[0], [0]],
  };
}

export interface Template {
  id: string;
  label: string;
  description: string;
  problem: Problem;
}

// Templates por domínio. São pontos de partida editáveis — o usuário pode
// ajustar variáveis, termos e pesos livremente.
export const TEMPLATES: Template[] = [
  {
    id: "carro",
    label: "Compra de carro",
    description: "Custo, conforto, consumo e potência.",
    problem: {
      name: "Compra de carro",
      alternatives: ["Carro A", "Carro B", "Carro C", "Carro D"],
      criteria: [
        { name: "Preço (R$ mil)", weight: 0.35, maximize: false, preference: "linear", q: 5, p: 20 },
        { name: "Conforto (1-10)", weight: 0.25, maximize: true, preference: "v_shape", p: 3 },
        { name: "Consumo (km/l)", weight: 0.25, maximize: true, preference: "usual" },
        { name: "Potência (cv)", weight: 0.15, maximize: true, preference: "gaussian", s: 20 },
      ],
      matrix: [
        [80, 7, 12, 110],
        [65, 5, 15, 90],
        [95, 9, 10, 140],
        [72, 6, 14, 100],
      ],
    },
  },
  {
    id: "fornecedor",
    label: "Escolha de fornecedor",
    description: "Preço, prazo, qualidade (qualitativa) e risco.",
    problem: {
      name: "Escolha de fornecedor",
      alternatives: ["Fornecedor X", "Fornecedor Y", "Fornecedor Z"],
      criteria: [
        { name: "Preço (R$/un)", weight: 0.3, maximize: false, preference: "linear", q: 0.5, p: 3 },
        { name: "Prazo (dias)", weight: 0.2, maximize: false, preference: "v_shape", p: 10 },
        {
          name: "Qualidade",
          weight: 0.3,
          maximize: true,
          preference: "level",
          q: 1,
          p: 2,
          scale: [
            { term: "Ruim", value: 1 },
            { term: "Regular", value: 2 },
            { term: "Boa", value: 3 },
            { term: "Excelente", value: 4 },
          ],
        },
        {
          name: "Risco de entrega",
          weight: 0.2,
          maximize: false,
          preference: "u_shape",
          q: 1,
          scale: [
            { term: "Baixo", value: 1 },
            { term: "Médio", value: 2 },
            { term: "Alto", value: 3 },
          ],
        },
      ],
      matrix: [
        [12, 30, 3, 1],
        [10, 45, 2, 2],
        [14, 20, 4, 1],
      ],
    },
  },
  {
    id: "contratacao",
    label: "Contratação de candidato",
    description: "Experiência, fit cultural, pretensão salarial.",
    problem: {
      name: "Contratação de candidato",
      alternatives: ["Candidato A", "Candidato B", "Candidato C"],
      criteria: [
        { name: "Experiência (anos)", weight: 0.3, maximize: true, preference: "v_shape", p: 5 },
        {
          name: "Fit cultural",
          weight: 0.35,
          maximize: true,
          preference: "level",
          q: 1,
          p: 2,
          scale: [
            { term: "Baixo", value: 1 },
            { term: "Médio", value: 2 },
            { term: "Alto", value: 3 },
          ],
        },
        { name: "Pretensão (R$ mil)", weight: 0.35, maximize: false, preference: "linear", q: 1, p: 5 },
      ],
      matrix: [
        [4, 3, 9],
        [7, 2, 12],
        [2, 3, 7],
      ],
    },
  },
];
