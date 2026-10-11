import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Scheme from '../models/Scheme.js';
import User from '../models/User.js';
import AnonymousReport from '../models/AnonymousReport.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const AUTHORITY_KEYS = {
  sarpanch: 'local_representative',
  block_officer: 'area_officer',
};

const AUTHORITY_TITLES = {
  'Village Sarpanch': 'Local Representative',
  'Block Development Officer': 'Area Officer',
};

function renameKey(expr) {
  return Object.entries(AUTHORITY_KEYS).reduceRight(
    (fallback, [from, to]) => ({ $cond: [{ $eq: [expr, from] }, to, fallback] }),
    expr
  );
}

function renameTitles(expr) {
  return {
    $cond: [
      { $eq: [{ $type: expr }, 'string'] },
      Object.entries(AUTHORITY_TITLES).reduce(
        (input, [find, replacement]) => ({ $replaceAll: { input, find, replacement } }),
        expr
      ),
      expr,
    ],
  };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ruralens');
  console.log(`Connected to ${mongoose.connection.name}`);

  const schemes = await Scheme.collection.updateMany(
    { village: { $exists: true } },
    { $rename: { village: 'area' } }
  );
  console.log(`Schemes: renamed village -> area on ${schemes.modifiedCount} documents`);

  const categories = await Scheme.collection.updateMany(
    { category: 'Rural Development' },
    { $set: { category: 'Local Development' } }
  );
  console.log(`Schemes: renamed category on ${categories.modifiedCount} documents`);

  const users = await User.collection.updateMany(
    { village: { $exists: true } },
    { $rename: { village: 'area' } }
  );
  console.log(`Users: renamed village -> area on ${users.modifiedCount} documents`);

  const reports = await AnonymousReport.collection.updateMany(
    {
      $or: [
        { 'escalationHistory.authority': { $in: Object.keys(AUTHORITY_KEYS) } },
        { 'escalationHistory.authorityName': { $in: Object.keys(AUTHORITY_TITLES) } },
        { 'statusUpdates.updatedByRole': { $in: Object.keys(AUTHORITY_KEYS) } },
        { 'statusUpdates.message': { $regex: Object.keys(AUTHORITY_TITLES).join('|') } },
      ],
    },
    [
      {
        $set: {
          escalationHistory: {
            $map: {
              input: { $ifNull: ['$escalationHistory', []] },
              as: 'e',
              in: {
                $mergeObjects: [
                  '$$e',
                  { authority: renameKey('$$e.authority'), authorityName: renameTitles('$$e.authorityName') },
                ],
              },
            },
          },
          statusUpdates: {
            $map: {
              input: { $ifNull: ['$statusUpdates', []] },
              as: 's',
              in: {
                $mergeObjects: [
                  '$$s',
                  { updatedByRole: renameKey('$$s.updatedByRole'), message: renameTitles('$$s.message') },
                ],
              },
            },
          },
        },
      },
    ]
  );
  console.log(`Anonymous reports: updated escalation authorities on ${reports.modifiedCount} documents`);
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
