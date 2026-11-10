import { sectionParts, withSectionAttr } from '@mtpk/content-kit/section';
import { cssFileRecord, externalStyleUrl } from '@mtpk/content-kit/styles';
import type { Block } from '@mtpk/content-model';
import type { RenderContext } from '../context.ts';
import { RawElement } from '../primitives/Html.tsx';
import { enhanceImages } from '../primitives/images-html.ts';
import { hasFormSlots, HtmlWithForms } from '../forms/FormSlot.tsx';
import { Adv } from './Adv.tsx';
import { BestOffer } from './BestOffer.tsx';
import { Calculators } from './Calculators.tsx';
import { CatalogCta } from './CatalogCta.tsx';
import { CatalogCards } from './CatalogCards.tsx';
import { CatalogList } from './CatalogList.tsx';
import { CategoryHero } from './CategoryHero.tsx';
import { HomeHero } from './HomeHero.tsx';
import { Leadgen } from './Leadgen.tsx';
import { Lightbox } from './Lightbox.tsx';
import { Partner } from './Partner.tsx';
import { PhotoReports } from './PhotoReports.tsx';
import { ProductHero } from './ProductHero.tsx';
import { ProductSpec } from './ProductSpec.tsx';
import { Container, Faq, ScriptLink, Stats, StyleLink } from './Simple.tsx';
import { StockList, StockShowcase } from './Stock.tsx';
import { Carousel, Cta, Features, Gallery, Marquee, RichText, Spacer, Video } from './Widgets.tsx';
import { WhyUs } from './WhyUs.tsx';

/** Один блок страницы → React-компонент. */
export function BlockView({ block, ctx }: { block: Block; ctx: RenderContext }) {
  switch (block.type) {
    case 'html': {
      // свой CSS и скрипт секции — у корня метка data-s (content-kit/section)
      const own = sectionParts(block);
      const html = own ? withSectionAttr(enhanceImages(block.html, ctx.eagerImages), own.sid) : enhanceImages(block.html, ctx.eagerImages);
      // формы в секции — тегом <ui-form>: на их месте компоненты форм
      const section = hasFormSlots(html) ? <HtmlWithForms html={html} /> : <RawElement html={html} />;
      if (!own) return section;
      return (
        <>
          {own.css &&
            (ctx.preview ? <style dangerouslySetInnerHTML={{ __html: own.css }} /> : <link rel="stylesheet" href={externalStyleUrl(cssFileRecord(own.css).hash)} />)}
          {section}
          {own.script && <ScriptLink block={{ type: 'script', code: own.script }} />}
        </>
      );
    }
    case 'text':
      return <>{block.text}</>;
    case 'style':
      return <StyleLink block={block} preview={ctx.preview} />;
    case 'script':
      return <ScriptLink block={block} />;
    case 'container':
      return <Container block={block} render={(children) => <Blocks blocks={children} ctx={ctx} />} />;
    case 'leadgen':
      return <Leadgen block={block} />;
    case 'bestOffer':
      return <BestOffer block={block} anchorId={ctx.hasLeadgenBlock ? 'best-offer' : 'leadgen'} />;
    case 'catalogCta':
      return <CatalogCta />;
    case 'partner':
      return <Partner />;
    case 'adv':
      return block.warranty ? <Adv warranty={block.warranty} /> : <Adv />;
    case 'whyUs':
      return <WhyUs months={block.months} />;
    case 'productHero':
      return <ProductHero block={block} ctx={ctx} />;
    case 'productSpec':
      return <ProductSpec block={block} />;
    case 'lightbox':
      return <Lightbox label={block.label} total={ctx.lightboxTotal ?? block.total} />;
    case 'catalogList':
      return <CatalogList block={block} ctx={ctx} />;
    case 'catalogCards':
      return <CatalogCards block={block} ctx={ctx} />;
    case 'stockShowcase':
      return <StockShowcase block={block} ctx={ctx} />;
    case 'stockList':
      return <StockList block={block} ctx={ctx} />;
    case 'photoReports':
      return <PhotoReports block={block} ctx={ctx} />;
    case 'calculators':
      return <Calculators block={block} ctx={ctx} />;
    case 'categoryHero':
      return <CategoryHero block={block} />;
    case 'homeHero':
      return <HomeHero block={block} holiday={ctx.holiday} />;
    case 'faq':
      return <Faq block={block} />;
    case 'stats':
      return <Stats block={block} />;
    case 'richText':
      return <RichText block={block} />;
    case 'gallery':
      return <Gallery block={block} />;
    case 'carousel':
      return <Carousel block={block} />;
    case 'marquee':
      return <Marquee block={block} />;
    case 'video':
      return <Video block={block} />;
    case 'features':
      return <Features block={block} />;
    case 'cta':
      return <Cta block={block} />;
    case 'spacer':
      return <Spacer block={block} />;
    default:
      return null;
  }
}

/** Содержимое страницы: блоки подряд, без обёрток (DOM как у исходной вёрстки). */
export function Blocks({ blocks, ctx }: { blocks: Block[]; ctx: RenderContext }) {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} ctx={ctx} />
      ))}
    </>
  );
}
