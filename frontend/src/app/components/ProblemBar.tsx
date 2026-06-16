"use client";

import { useEffect, useRef, useState } from "react";
import { FilePlus2, FolderOpen, Save, Trash2, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { blankProblem, TEMPLATES, type Problem } from "@/lib/templates";
import {
  deleteSaved,
  exportProblemFile,
  importProblemFile,
  listSaved,
  saveProblem,
  type SavedProblem,
} from "@/lib/storage";

interface Props {
  problem: Problem; // estado atual montado pela página
  name: string;
  onNameChange: (name: string) => void;
  onLoad: (problem: Problem) => void;
}

// Barra de gerenciamento do problema: começar do zero, carregar templates,
// salvar/recarregar (localStorage) e importar/exportar JSON.
export function ProblemBar({ problem, name, onNameChange, onLoad }: Props) {
  const [saved, setSaved] = useState<SavedProblem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setSaved(listSaved()), []);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  }

  function handleTemplate(id: string) {
    const t = TEMPLATES.find((t) => t.id === id);
    if (t) onLoad(structuredClone(t.problem));
  }

  function handleSave() {
    setSaved(saveProblem(name, problem));
    flash(`"${name.trim() || "Sem nome"}" salvo neste navegador.`);
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    setImportError(null);
    try {
      onLoad(await importProblemFile(file));
      flash("Problema importado.");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Falha ao importar.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Card className="mb-6 [--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <StepMarker />
          Problema
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Nome do problema</span>
            <Input
              className="w-64"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ex.: Escolha de fornecedor"
            />
          </label>

          <Button variant="outline" size="sm" onClick={() => onLoad(blankProblem())}>
            <FilePlus2 /> Começar do zero
          </Button>

          <Select value="" onValueChange={handleTemplate}>
            <SelectTrigger className="w-[200px]" size="sm">
              <SelectValue placeholder="Carregar template…" />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save /> Salvar
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload /> Importar
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportProblemFile(problem)}>
              <Download /> Exportar
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => handleImport(e.target.files?.[0])}
            />
          </div>
        </div>

        {notice && <p className="text-xs text-primary">{notice}</p>}
        {importError && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {importError}
          </p>
        )}

        {saved.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">Salvos neste navegador</p>
            <div className="flex flex-wrap gap-2">
              {saved.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-1 rounded-md border bg-muted/20 py-1 pl-2.5 pr-1 text-sm"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 hover:text-primary"
                    onClick={() => onLoad(structuredClone(s.problem))}
                    title="Carregar"
                  >
                    <FolderOpen className="size-3.5 text-muted-foreground" />
                    {s.name}
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                    onClick={() => setSaved(deleteSaved(s.id))}
                    aria-label={`Remover ${s.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepMarker() {
  return (
    <span className="tnum inline-flex size-5 items-center justify-center rounded-md bg-secondary text-xs font-medium text-secondary-foreground">
      0
    </span>
  );
}
