import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { TEMPLATES } from '@/engine/templates';
import { describeParams } from '@/lib/specs';
import { slugify } from '@/lib/utils';

/**
 * Gera e baixa o relatório PDF do projeto.
 * O gerador (jsPDF) é importado sob demanda, só quando o usuário clica em exportar.
 */
export function useExportPdf() {
  const results = useResults();
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { buildPdfReport } = await import('@/export/pdfReport');
      const s = useProjectStore.getState();
      const params = s.templateId === 'workbench' ? s.workbenchParams : s.cabinetParams[s.templateId];
      const doc = buildPdfReport({
        ...results,
        projectName: s.projectName || 'Projeto',
        templateName: TEMPLATES[s.templateId].name,
        date: new Date(),
        specs: describeParams(s.templateId, params),
      });
      doc.save(`${slugify(s.projectName)}-projeto.pdf`);
    } catch (err) {
      console.error(err);
      alert('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  return { exportPdf, exporting };
}
