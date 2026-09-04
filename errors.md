  Downloading fastapi-0.115.6-py3-none-any.whl.metadata (27 kB)
Collecting uvicorn==0.34.0 (from uvicorn[standard]==0.34.0->-r requirements.txt (line 2))
  Downloading uvicorn-0.34.0-py3-none-any.whl.metadata (6.5 kB)
Collecting google-cloud-bigquery==3.27.0 (from -r requirements.txt (line 3))
  Downloading google_cloud_bigquery-3.27.0-py2.py3-none-any.whl.metadata (8.6 kB)
Collecting pydantic==2.10.4 (from -r requirements.txt (line 4))
  Downloading pydantic-2.10.4-py3-none-any.whl.metadata (29 kB)
Collecting pydantic-settings==2.7.0 (from -r requirements.txt (line 5))
  Downloading pydantic_settings-2.7.0-py3-none-any.whl.metadata (3.5 kB)
Collecting starlette<0.42.0,>=0.40.0 (from fastapi==0.115.6->-r requirements.txt (line 1))
  Downloading starlette-0.41.3-py3-none-any.whl.metadata (6.0 kB)
Collecting typing-extensions>=4.8.0 (from fastapi==0.115.6->-r requirements.txt (line 1))
  Downloading typing_extensions-4.16.0-py3-none-any.whl.metadata (3.3 kB)
Collecting annotated-types>=0.6.0 (from pydantic==2.10.4->-r requirements.txt (line 4))
  Downloading annotated_types-0.8.0-py3-none-any.whl.metadata (15 kB)
Collecting pydantic-core==2.27.2 (from pydantic==2.10.4->-r requirements.txt (line 4))
  Downloading pydantic_core-2.27.2.tar.gz (413 kB)
  Installing build dependencies: started
  Installing build dependencies: finished with status 'done'
  Getting requirements to build wheel: started
  Getting requirements to build wheel: finished with status 'done'
  Preparing metadata (pyproject.toml): started
  Preparing metadata (pyproject.toml): finished with status 'error'
  error: subprocess-exited-with-error
  
  × Preparing metadata (pyproject.toml) did not run successfully.
  │ exit code: 1
  ╰─> [14 lines of output]
          Updating crates.io index
      warning: failed to write cache, path: /usr/local/cargo/registry/index/index.crates.io-1949cf8c6b5b557f/.cache/ve/rs/version_check, error: Read-only file system (os error 30)
       Downloading crates ...
        Downloaded ahash v0.8.11
      error: failed to create directory `/usr/local/cargo/registry/cache/index.crates.io-1949cf8c6b5b557f`
      
      Caused by:
        Read-only file system (os error 30)
      💥 maturin failed
        Caused by: Cargo metadata failed. Does your crate compile with `cargo build`?
        Caused by: `cargo metadata` exited with an error:
      Error running maturin: Command '['maturin', 'pep517', 'write-dist-info', '--metadata-directory', '/tmp/pip-modern-metadata-d7z8nxy3', '--interpreter', '/opt/render/project/src/.venv/bin/python3.14']' returned non-zero exit status 1.
      Checking for Rust toolchain....
      Running `maturin pep517 write-dist-info --metadata-directory /tmp/pip-modern-metadata-d7z8nxy3 --interpreter /opt/render/project/src/.venv/bin/python3.14`
      [end of output]
  
  note: This error originates from a subprocess, and is likely not a problem with pip.
[notice] A new release of pip is available: 25.3 -> 26.2.1
[notice] To update, run: pip install --upgrade pip
error: metadata-generation-failed
× Encountered error while generating package metadata.
╰─> pydantic-core
note: This is an issue with the package mentioned above, not pip.
hint: See above for details.
==> Build failed 😞
==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys
N