require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
repository_url = package['repository']['url'].sub(/\Agit\+/, '')

Pod::Spec.new do |spec|
  spec.name = 'CapacitorOidc'
  spec.version = package['version']
  spec.summary = package['description']
  spec.license = package['license']
  spec.homepage = package['homepage']
  spec.author = package['author']
  spec.source = { git: repository_url, tag: spec.version.to_s }
  spec.source_files = 'ios/Sources/**/*.{swift,h,m,c,cc,mm,cpp}'
  spec.ios.deployment_target = '15.0'
  spec.dependency 'Capacitor', '>= 7.0'
  spec.swift_version = '5.9'
end
