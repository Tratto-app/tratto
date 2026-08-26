import type { MetadataRoute } from 'next';

import { siteUrl } from '@/data/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${siteUrl}/servicios`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${siteUrl}/precios`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
  ];
}
