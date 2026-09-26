import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useResults } from '@/hooks/ProjectResults';
import { TEMPLATES } from '@/engine/templates';
import { describeParams } from '@/lib/specs';
import { slugify } from '@/lib/utils';
import { producible } from '@/engine/projectEngine';

/**
 * Gera e baixa o relatório PDF do projeto.
 * O gerador (jsPDF) é importado sob demanda, só quando o usuário clica em exportar.
 */
export function useExportPdf() {
  const results = useResults();
  const projectName = useProjectStore((s) => s.projectName);
  const room = useProjectStore((s) => s.room);
  const snapshots = useProjectStore((s) => s.snapshots);
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { buildPdfReport } = await import('@/export/pdfReport');
      const doc = buildPdfReport({
        ...results,
        projectName: projectName || 'Projeto',
        date: new Date(),
        room,
        placements: results.placements,
        images: snapshots,
        // Objetos do ambiente (sofá, geladeira...) não são produzidos: ficam só na planta e nas imagens.
        items: producible(results.items).map(({ item, model }) => ({
          name: item.name,
          templateName: TEMPLATES[item.templateId].name,
          quantity: item.quantity,
          specs: describeParams(item.templateId, item.params),
          model,
        })),
      });
      doc.save(`${slugify(projectName)}-projeto.pdf`);
    } catch (err) {
      console.error(err);
      alert('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  return { exportPdf, exporting };
}
