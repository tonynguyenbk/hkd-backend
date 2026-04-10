const pool = require('../config/db');

const findByUser = (userId) =>
  pool.query('SELECT * FROM hkd_profiles WHERE user_id=$1 ORDER BY created_at DESC', [userId]);

const findById = (id, userId) =>
  pool.query('SELECT id FROM hkd_profiles WHERE id=$1 AND user_id=$2', [id, userId]);

const findByIdOnly = (id) =>
  pool.query('SELECT * FROM hkd_profiles WHERE id=$1', [id]);

const create = (userId, { name, industry, size, region, province, duration, mst, address }) =>
  pool.query(
    `INSERT INTO hkd_profiles(user_id,name,industry,size,region,province,duration,mst,address)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [userId, name, industry || 'thuong_mai', size || 'sieu_nho', region || 'tinh_lon',
     province || '', duration || '', mst || '', address || '']
  );

const update = (id, userId, { name, industry, size, region, province, duration, mst }) =>
  pool.query(
    `UPDATE hkd_profiles SET name=$1,industry=$2,size=$3,region=$4,province=$5,duration=$6,mst=$7
     WHERE id=$8 AND user_id=$9 RETURNING *`,
    [name, industry, size, region, province, duration, mst, id, userId]
  );

const remove = (id, userId) =>
  pool.query('DELETE FROM hkd_profiles WHERE id=$1 AND user_id=$2', [id, userId]);

module.exports = { findByUser, findById, findByIdOnly, create, update, remove };
